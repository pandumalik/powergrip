import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SRE_LEAD' | 'PROJECT_MANAGER' | 'DEVOPS_ENGINEER' | 'SECURITY_OFFICER';
  jobTitle: string;
  avatar: string;
}

export const DEMO_USERS: UserProfile[] = [
  {
    id: 'e111',
    name: 'Victor Kurniawan',
    email: 'victor.k@vendor.internal',
    role: 'ADMIN',
    jobTitle: 'Chief Technology Officer (Admin)',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'e222',
    name: 'Alex Mercer',
    email: 'alex.mercer@vendor.internal',
    role: 'SRE_LEAD',
    jobTitle: 'Head of Cloud Operations & SRE',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'e333',
    name: 'Jane Doe',
    email: 'jane.doe@vendor.internal',
    role: 'DEVOPS_ENGINEER',
    jobTitle: 'Senior Cloud Platform Engineer',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'e444',
    name: 'Farhan Rizky',
    email: 'farhan.r@vendor.internal',
    role: 'SECURITY_OFFICER',
    jobTitle: 'Principal Security Officer',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
  },
];

interface AuthContextType {
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  switchUserRole: (role: UserProfile['role']) => void;
  isKeycloakActive: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_USERS[1]); // Default to SRE Lead
  const [isKeycloakActive] = useState<boolean>(false);

  const switchUserRole = (role: UserProfile['role']) => {
    const found = DEMO_USERS.find((u) => u.role === role) || DEMO_USERS[0];
    setCurrentUser(found);
  };

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, switchUserRole, isKeycloakActive }}>
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
