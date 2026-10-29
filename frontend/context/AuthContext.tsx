'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { API_ENDPOINTS, BASE_URL, ROUTES, STORAGE_KEYS } from '@/data/ENUM';

export interface AuthUser {
  phone_number: string;
  user_name: string;
  email?: string | null;
  name?: string; // fallback alias for UI components
  role: string;
  is_granted: boolean;
}

export interface SignupResult {
  status: string;
  is_granted: boolean;
  message: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAdminOrSuperAdmin: boolean;
  login: (phone_number: string, password: string) => Promise<void>;
  signup: (
    phone_number: string,
    password: string,
    user_name: string,
    email?: string,
    role?: string
  ) => Promise<SignupResult>;
  logout: () => void;
  getValidAccessToken: () => Promise<string | null>;
  fetchWithAuth: (url: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Decode JWT payload client-side without external dependencies.
 */
function parseJwtPayload(token: string): { exp?: number; [key: string]: unknown } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Checks if a token is expired or will expire within bufferSeconds.
 */
function isTokenExpired(token: string, bufferSeconds = 30): boolean {
  const payload = parseJwtPayload(token);
  if (!payload || !payload.exp) return true;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowInSeconds + bufferSeconds;
}

/**
 * Formats API errors into clean readable text, avoiding [object Object].
 */
function formatApiError(data: any, fallback: string): string {
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail) && data.detail.length > 0) {
    return data.detail
      .map((err: any) => {
        if (typeof err === 'string') return err;
        const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : '';
        const prefix = field ? `${String(field).replace(/_/g, ' ')}: ` : '';
        return `${prefix}${err.msg || 'Invalid input'}`;
      })
      .join('; ');
  }
  if (typeof data.message === 'string') return data.message;
  return fallback;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const pathname = usePathname();
  const router = useRouter();
  const isRefreshingRef = useRef<Promise<string | null> | null>(null);

  const clearAuthSession = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    } catch (e) {
      console.error('Error clearing localStorage auth items:', e);
    }
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    router.replace(ROUTES.LOGIN);
  }, [clearAuthSession, router]);

  /**
   * Refreshes the access token using the stored refresh token.
   * Prevents multiple concurrent refresh requests.
   */
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (isRefreshingRef.current) {
      return isRefreshingRef.current;
    }

    const currentRefreshToken =
      refreshToken ||
      (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) : null);

    if (!currentRefreshToken) {
      clearAuthSession();
      return null;
    }

    if (isTokenExpired(currentRefreshToken, 5)) {
      console.warn('Refresh token is expired. User must log in again.');
      clearAuthSession();
      return null;
    }

    const refreshPromise = (async () => {
      try {
        const response = await fetch(`${BASE_URL}${API_ENDPOINTS.REFRESH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: currentRefreshToken }),
        });

        if (!response.ok) {
          clearAuthSession();
          return null;
        }

        const data = await response.json();
        const newAccess = data.access_token;
        const updatedUser: AuthUser = {
          ...data.user,
          name: data.user.user_name,
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccess);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        }

        setAccessToken(newAccess);
        setUser(updatedUser);
        return newAccess;
      } catch (err) {
        console.error('Failed to refresh access token:', err);
        clearAuthSession();
        return null;
      } finally {
        isRefreshingRef.current = null;
      }
    })();

    isRefreshingRef.current = refreshPromise;
    return refreshPromise;
  }, [refreshToken, clearAuthSession]);

  /**
   * Returns a valid access token, auto-refreshing if expired.
   */
  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    const currentAccess =
      accessToken ||
      (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) : null);

    if (currentAccess && !isTokenExpired(currentAccess)) {
      return currentAccess;
    }

    return await refreshAccessToken();
  }, [accessToken, refreshAccessToken]);

  /**
   * Authenticated fetch helper for any API call.
   */
  const fetchWithAuth = useCallback(
    async (url: string, init?: RequestInit): Promise<Response> => {
      let token = await getValidAccessToken();

      const headers = new Headers(init?.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      let response = await fetch(url, { ...init, headers });

      if (response.status === 401) {
        token = await refreshAccessToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
          response = await fetch(url, { ...init, headers });
        } else {
          logout();
        }
      }

      return response;
    },
    [getValidAccessToken, refreshAccessToken, logout]
  );

  /**
   * User Login: Authenticates with phone_number & password.
   * Checks isGranted approval status.
   */
  const login = useCallback(
    async (phone_number: string, password: string) => {
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.LOGIN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number, password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(formatApiError(data, 'Login failed. Please check your credentials.'));
      }

      const loggedUser: AuthUser = {
        ...data.user,
        name: data.user.user_name,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(loggedUser));
      }

      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);
      setUser(loggedUser);

      router.replace(ROUTES.HOME);
    },
    [router]
  );

  /**
   * User Sign Up: Registers with phone_number, password, user_name, email, and role.
   * Admin and SuperAdmin get automatic tokens.
   * User and Manager get waiting list status.
   */
  const signup = useCallback(
    async (
      phone_number: string,
      password: string,
      user_name: string,
      email?: string,
      role: string = 'user'
    ): Promise<SignupResult> => {
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.SIGNUP}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number,
          password,
          user_name,
          email: email && email.trim() ? email.trim() : null,
          role,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(formatApiError(data, 'Registration failed. Please check your details.'));
      }

      const registeredUser: AuthUser = {
        ...data.user,
        name: data.user.user_name,
      };

      // If granted (admin or superadmin), save tokens and navigate
      if (data.is_granted && data.access_token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(registeredUser));
        }

        setAccessToken(data.access_token);
        setRefreshToken(data.refresh_token);
        setUser(registeredUser);

        router.replace(ROUTES.HOME);
      }

      return {
        status: data.status,
        is_granted: data.is_granted,
        message: data.message,
        user: registeredUser,
      };
    },
    [router]
  );

  /**
   * Session check on route change
   */
  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndRoute() {
      if (typeof window === 'undefined') return;

      const isPublicRoute = pathname === ROUTES.LOGIN || pathname === ROUTES.SIGNUP;
      const storedAccess = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const storedRefresh = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      const storedUserRaw = localStorage.getItem(STORAGE_KEYS.USER);

      let parsedUser: AuthUser | null = null;
      if (storedUserRaw) {
        try {
          parsedUser = JSON.parse(storedUserRaw);
        } catch {
          parsedUser = null;
        }
      }

      // No tokens found
      if (!storedAccess && !storedRefresh) {
        if (isMounted) {
          clearAuthSession();
          setIsLoading(false);
        }
        if (!isPublicRoute) {
          router.replace(ROUTES.LOGIN);
        }
        return;
      }

      // Tokens exist: check if access token is valid
      if (storedAccess && !isTokenExpired(storedAccess)) {
        if (isMounted) {
          setAccessToken(storedAccess);
          setRefreshToken(storedRefresh);
          if (parsedUser) setUser(parsedUser);
          setIsLoading(false);
        }
        if (isPublicRoute) {
          router.replace(ROUTES.HOME);
        }
        return;
      }

      // Access token expired, attempt renewal via refresh token
      if (storedRefresh && !isTokenExpired(storedRefresh, 5)) {
        const newAccess = await refreshAccessToken();
        if (isMounted) {
          setIsLoading(false);
        }
        if (newAccess) {
          if (isPublicRoute) {
            router.replace(ROUTES.HOME);
          }
        } else {
          if (!isPublicRoute) {
            router.replace(ROUTES.LOGIN);
          }
        }
      } else {
        if (isMounted) {
          clearAuthSession();
          setIsLoading(false);
        }
        if (!isPublicRoute) {
          router.replace(ROUTES.LOGIN);
        }
      }
    }

    checkAuthAndRoute();

    return () => {
      isMounted = false;
    };
  }, [pathname, refreshAccessToken, clearAuthSession, router]);

  const userRole = (user?.role || '').toLowerCase();
  const isAdminOrSuperAdmin = userRole === 'admin' || userRole === 'superadmin';

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isLoading,
        isAdminOrSuperAdmin,
        login,
        signup,
        logout,
        getValidAccessToken,
        fetchWithAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
