import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { ACCESS_TOKEN_STORAGE_KEY, getAccessToken } from "@/api/tokens";

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
  /** Bumps when tokens change so in-flight `fetchMe` from an older session cannot overwrite state. */
  const sessionEpochRef = useRef(0);

  const refreshSession = useCallback(async () => {
    const epochAtStart = sessionEpochRef.current;
    if (!getAccessToken()) {
      if (epochAtStart !== sessionEpochRef.current) return;
      setUser(null);
      setOrganization(null);
      return;
    }
    const data = await fetchMe();
    if (epochAtStart !== sessionEpochRef.current) return;
    setUser(data.user);
    setOrganization(data.organization);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const epochAtStart = sessionEpochRef.current;
    (async () => {
      if (!getAccessToken()) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const data = await fetchMe();
        if (cancelled) return;
        if (epochAtStart !== sessionEpochRef.current) return;
        setUser(data.user);
        setOrganization(data.organization);
      } catch {
        if (cancelled) return;
        if (epochAtStart !== sessionEpochRef.current) return;
        setUser(null);
        setOrganization(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.storageArea !== localStorage || e.key !== ACCESS_TOKEN_STORAGE_KEY) return;
      sessionEpochRef.current += 1;
      const epochAtStart = sessionEpochRef.current;
      void (async () => {
        if (e.newValue === null) {
          setUser(null);
          setOrganization(null);
          return;
        }
        try {
          const data = await fetchMe();
          if (epochAtStart !== sessionEpochRef.current) return;
          setUser(data.user);
          setOrganization(data.organization);
        } catch {
          if (epochAtStart !== sessionEpochRef.current) return;
          setUser(null);
          setOrganization(null);
        }
      })();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginRequest(email, password);
    sessionEpochRef.current += 1;
    persistSession(data);
    const me = await fetchMe();
    setUser(me.user);
    setOrganization(me.organization);
    return me.user;
  }, []);

  const setSessionFromAuthResponse = useCallback(async (data: LoginResponse) => {
    sessionEpochRef.current += 1;
    persistSession(data);
    const me = await fetchMe();
    setUser(me.user);
    setOrganization(me.organization);
    return me.user;
  }, []);

  const logout = useCallback(async () => {
    sessionEpochRef.current += 1;
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
