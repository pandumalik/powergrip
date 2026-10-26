import React, { createContext, useContext, useState, useMemo } from 'react';
import { api } from '@/services/api';
import { getRolePermissions, RolePermissions } from '@/utils/permissions';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Employee' | string;
  jobTitle: string;
  avatar: string;
  hierarchyPath?: string;
  authProvider?: 'google' | 'keycloak' | 'credentials';
  gcpConnected?: boolean;
  gcpAccount?: string;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  permissions: RolePermissions;
  login: (user: UserProfile) => void;
  loginWithGoogle: (googleData: {
    email: string;
    name?: string;
    picture?: string;
    sub?: string;
    token?: string;
    credential?: string;
  }) => Promise<UserProfile>;
  loginWithCredentials: (email: string, password?: string) => Promise<UserProfile>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('powergrip_auth_user');
      const isAuth = localStorage.getItem('powergrip_authenticated') === 'true';
      if (saved && isAuth) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved user', e);
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem('powergrip_auth_user');
    return !!(saved && localStorage.getItem('powergrip_authenticated') === 'true');
  });

  const permissions = useMemo(() => {
    return getRolePermissions(currentUser?.role);
  }, [currentUser?.role]);

  const login = (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('powergrip_auth_user', JSON.stringify(user));
    localStorage.setItem('powergrip_authenticated', 'true');
  };

  const loginWithGoogle = async (googleData: {
    email: string;
    name?: string;
    picture?: string;
    sub?: string;
    token?: string;
    credential?: string;
  }): Promise<UserProfile> => {
    const authRes = await api.loginWithGoogle(googleData);
    const user: UserProfile = {
      id: authRes.user.id,
      name: authRes.user.name,
      email: authRes.user.email,
      role: authRes.user.role || 'Admin',
      jobTitle: authRes.user.job_title,
      avatar: authRes.user.avatar,
      authProvider: 'google',
      gcpConnected: true,
      gcpAccount: authRes.user.gcp_account || googleData.email,
    };
    login(user);
    if (authRes.token) {
      localStorage.setItem('powergrip_auth_token', authRes.token);
    }
    return user;
  };

  const loginWithCredentials = async (email: string, password?: string): Promise<UserProfile> => {
    let keycloakToken = null;
    let keycloakRole: string | undefined = undefined;

    // 1. First authenticate with Keycloak 26 Identity Provider
    try {
      if (password) {
        const kcData = await api.loginWithKeycloak(email, password);
        if (kcData?.access_token) {
          keycloakToken = kcData.access_token;
          // Decode realm roles from Keycloak JWT
          try {
            const payload = JSON.parse(atob(kcData.access_token.split('.')[1]));
            const roles = payload.realm_access?.roles || [];
            if (roles.includes('Admin') || roles.includes('ADMIN')) keycloakRole = 'Admin';
            else if (roles.includes('Manager') || roles.includes('MANAGER')) keycloakRole = 'Manager';
            else if (roles.includes('Employee') || roles.includes('EMPLOYEE')) keycloakRole = 'Employee';
          } catch {}
        }
      }
    } catch (kcErr: any) {
      console.warn('[AuthContext] Keycloak login notice:', kcErr.message);
      // If Keycloak returned an explicit bad credentials error, propagate it
      if (kcErr.message && !kcErr.message.includes('Failed to fetch')) {
        throw new Error(kcErr.message);
      }
    }

    // 2. Sync with backend Postgres database employee record
    const authRes = await api.login({ email, password });
    const userRole = keycloakRole || authRes.user.role || 'Employee';

    const user: UserProfile = {
      id: authRes.user.id,
      name: authRes.user.name,
      email: authRes.user.email,
      role: userRole,
      jobTitle: authRes.user.job_title,
      avatar: authRes.user.avatar,
      hierarchyPath: authRes.user.hierarchy_path,
      authProvider: keycloakToken ? 'keycloak' : 'credentials',
      gcpConnected: false,
    };

    login(user);
    if (keycloakToken || authRes.token) {
      localStorage.setItem('powergrip_auth_token', keycloakToken || authRes.token);
    }
    return user;
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('powergrip_auth_user');
    localStorage.removeItem('powergrip_authenticated');
    localStorage.removeItem('powergrip_auth_token');
    try {
      (window as any).google?.accounts?.id?.disableAutoSelect?.();
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        permissions,
        login,
        loginWithGoogle,
        loginWithCredentials,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
