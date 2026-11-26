import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearToken, getToken, setToken } from '../api/client';
import type { AuthResponse, DemoResponse, Farmer } from '../types';

interface AuthContextValue {
  farmer: Farmer | null;
  token: string | null;
  ready: boolean;
  signIn: (response: AuthResponse) => void;
  startDemo: () => Promise<DemoResponse>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setCurrentToken] = useState<string | null>(() => getToken());
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setReady(true);
      return undefined;
    }

    api
      .me()
      .then(({ farmer: current }) => {
        if (active) setFarmer(current);
      })
      .catch(() => {
        if (!active) return;
        clearToken();
        setCurrentToken(null);
        setFarmer(null);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const signIn = (response: AuthResponse) => {
    setToken(response.token);
    setCurrentToken(response.token);
    setFarmer(response.farmer);
    setReady(true);
  };

  const startDemo = async () => {
    const response = await api.demoStart();
    signIn(response);
    return response;
  };

  const signOut = async () => {
    try {
      await api.logout();
    } catch {
      clearToken();
    }
    setCurrentToken(null);
    setFarmer(null);
  };

  return (
    <AuthContext.Provider value={{ farmer, token, ready, signIn, startDemo, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
