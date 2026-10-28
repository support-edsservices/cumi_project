'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_ENDPOINTS, BASE_URL, DEMO_ACCOUNT, STORAGE_KEYS } from '@/data/ENUM';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return typeof user.id === 'string'
    && typeof user.name === 'string'
    && typeof user.email === 'string'
    && typeof user.role === 'string';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const savedSession = localStorage.getItem(STORAGE_KEYS.SESSION);
        if (savedSession) {
          const session: unknown = JSON.parse(savedSession);
          if (isAuthUser(session)) setUser(session);
          else localStorage.removeItem(STORAGE_KEYS.SESSION);
        }
      } catch (error) {
        console.error('Unable to restore the saved authentication session.', error);
        localStorage.removeItem(STORAGE_KEYS.SESSION);
      } finally {
        setIsLoading(false);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    let authenticatedUser: AuthUser;

    if (BASE_URL) {
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.LOGIN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error(`Login failed (${response.status}).`);
      }

      const result: unknown = await response.json();
      const responseUser = result && typeof result === 'object'
        ? (result as Record<string, unknown>).user
        : null;
      if (!isAuthUser(responseUser)) {
        throw new Error('The login response did not contain a valid user.');
      }
      authenticatedUser = responseUser;
    } else {
      if (email !== DEMO_ACCOUNT.email || password !== DEMO_ACCOUNT.password) {
        throw new Error('Invalid email or password.');
      }
      authenticatedUser = {
        id: 'demo-user',
        name: 'Admin',
        email: DEMO_ACCOUNT.email,
        role: 'Administrator',
      };
    }

    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}
