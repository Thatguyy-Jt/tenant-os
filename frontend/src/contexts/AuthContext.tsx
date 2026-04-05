import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  fetchMe,
  loginRequest,
  logoutRequest,
  persistSession,
} from "@/api/authApi";
import type { AuthUser, LoginResponse, OrganizationSummary } from "@/api/types";
import { getAccessToken } from "@/api/tokens";

type AuthContextValue = {
  user: AuthUser | null;
  organization: OrganizationSummary | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  setSessionFromAuthResponse: (data: LoginResponse) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setOrganization(null);
      return;
    }
    const data = await fetchMe();
    setUser(data.user);
    setOrganization(data.organization);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getAccessToken()) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const data = await fetchMe();
        if (!cancelled) {
          setUser(data.user);
          setOrganization(data.organization);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setOrganization(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginRequest(email, password);
    persistSession(data);
    const me = await fetchMe();
    setUser(me.user);
    setOrganization(me.organization);
    return me.user;
  }, []);

  const setSessionFromAuthResponse = useCallback(async (data: LoginResponse) => {
    persistSession(data);
    const me = await fetchMe();
    setUser(me.user);
    setOrganization(me.organization);
    return me.user;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setOrganization(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      organization,
      loading,
      login,
      setSessionFromAuthResponse,
      logout,
      refreshSession,
    }),
    [user, organization, loading, login, setSessionFromAuthResponse, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
