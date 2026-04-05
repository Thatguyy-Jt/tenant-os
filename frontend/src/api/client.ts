import { getApiBaseUrl } from "@/lib/env";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/api/tokens";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const rt = getRefreshToken();
  if (!rt) {
    clearTokens();
    return null;
  }
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) {
        clearTokens();
        return null;
      }
      const data = (await res.json()) as {
        accessToken?: string;
        token?: string;
        refreshToken: string;
      };
      const access = data.accessToken ?? data.token;
      if (!access) {
        clearTokens();
        return null;
      }
      setTokens(access, data.refreshToken);
      return access;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/**
 * Authenticated fetch to the API. Retries once after refreshing the access token on 401.
 * Does not attach auth for `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/invitations/accept`.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const publicPaths = [
    "/auth/login",
    "/auth/register",
    "/auth/refresh",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify-email",
    "/invitations/accept",
  ];
  const isPublic = publicPaths.some((p) => url.includes(p));

  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (!isPublic) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(url, { ...init, headers });

  if (res.status === 401 && !isPublic && !url.includes("/auth/refresh")) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      const retryHeaders = new Headers(init.headers);
      if (!retryHeaders.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
        retryHeaders.set("Content-Type", "application/json");
      }
      retryHeaders.set("Authorization", `Bearer ${newAccess}`);
      res = await fetch(url, { ...init, headers: retryHeaders });
    }
  }

  return res;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const err = body as Record<string, unknown> | null;
    let message = res.statusText ?? "Request failed";
    let code: string | undefined;
    if (err && typeof err === "object") {
      const nested = err.error;
      if (
        nested &&
        typeof nested === "object" &&
        nested !== null &&
        "message" in nested &&
        typeof (nested as { message: unknown }).message === "string"
      ) {
        message = (nested as { message: string }).message;
        if ("code" in nested && typeof (nested as { code: unknown }).code === "string") {
          code = (nested as { code: string }).code;
        }
      } else if (typeof err.message === "string") {
        message = err.message;
      }
    }
    throw new ApiError(message, res.status, code);
  }

  return body as T;
}
