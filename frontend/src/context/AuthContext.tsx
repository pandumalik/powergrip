import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/services/api';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SRE_LEAD' | 'PROJECT_MANAGER' | 'DEVOPS_ENGINEER' | 'SECURITY_OFFICER';
  jobTitle: string;
  avatar: string;
  gcpConnected?: boolean;
  gcpAccount?: string;
}

export const DEMO_USERS: UserProfile[] = [
  {
    id: 'emp-galang-001',
    name: 'Muhammad Galang',
    email: 'muhammad.galang@ist.id',
    role: 'ADMIN',
    jobTitle: 'Principal Cloud Architect & PowerGrip Superadmin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    gcpConnected: true,
    gcpAccount: 'muhammad.galang@ist.id',
  },
  {
    id: 'e222',
    name: 'Alex Mercer',
    email: 'alex.mercer@vendor.internal',
    role: 'SRE_LEAD',
    jobTitle: 'Head of Cloud Operations & SRE',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    gcpConnected: false,
  },
  {
    id: 'e333',
    name: 'Jane Doe',
    email: 'jane.doe@vendor.internal',
    role: 'DEVOPS_ENGINEER',
    jobTitle: 'Senior Cloud Platform Engineer',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    gcpConnected: false,
  },
  {
    id: 'e444',
    name: 'Farhan Rizky',
    email: 'farhan.r@vendor.internal',
    role: 'SECURITY_OFFICER',
    jobTitle: 'Principal Security Officer',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    gcpConnected: false,
  },
];

interface GcpStatusState {
  available: boolean;
  connected: boolean;
  account: string | null;
  isAdmin: boolean;
  message: string;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  login: (user: UserProfile) => void;
  loginWithGoogle: () => Promise<UserProfile>;
  logout: () => void;
  switchUserRole: (role: UserProfile['role']) => void;
  isKeycloakActive: boolean;
  gcpStatus: GcpStatusState;
  refreshGcpStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('powergrip_auth_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved user', e);
    }
    // Default to Muhammad Galang (Admin) if previously logged in, or null
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('powergrip_authenticated') === 'true';
  });

  const [isKeycloakActive] = useState<boolean>(false);
  const [gcpStatus, setGcpStatus] = useState<GcpStatusState>({
    available: false,
    connected: false,
    account: null,
    isAdmin: false,
    message: 'Checking Google Cloud identity...',
  });

  const refreshGcpStatus = async () => {
    try {
      const status = await api.getGcpAuthStatus();
      setGcpStatus(status);
    } catch (err) {
      console.error('Failed to query GCP auth status', err);
    }
  };

  useEffect(() => {
    refreshGcpStatus();
  }, []);

  const login = (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('powergrip_auth_user', JSON.stringify(user));
    localStorage.setItem('powergrip_authenticated', 'true');
  };

  const loginWithGoogle = async (): Promise<UserProfile> => {
    const authRes = await api.login({ provider: 'google' });
    const user: UserProfile = {
      id: authRes.user.id,
      name: authRes.user.name,
      email: authRes.user.email,
      role: authRes.user.role as any,
      jobTitle: authRes.user.job_title,
      avatar: authRes.user.avatar,
      gcpConnected: authRes.user.gcp_connected,
      gcpAccount: authRes.user.gcp_account,
    };
    login(user);
    return user;
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('powergrip_auth_user');
    localStorage.removeItem('powergrip_authenticated');
  };

  const switchUserRole = (role: UserProfile['role']) => {
    const found = DEMO_USERS.find((u) => u.role === role) || DEMO_USERS[0];
    login(found);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        login,
        loginWithGoogle,
        logout,
        switchUserRole,
        isKeycloakActive,
        gcpStatus,
        refreshGcpStatus,
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
