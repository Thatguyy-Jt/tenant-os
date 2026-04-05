import { apiFetch, apiJson } from "@/api/client";
import type {
  AcceptInvitationResponse,
  LoginResponse,
  MeResponse,
  RegisterResponse,
} from "@/api/types";
import { clearTokens, getRefreshToken, setTokens } from "@/api/tokens";

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  return apiJson<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function persistSession(data: LoginResponse): void {
  const access = data.accessToken ?? data.token;
  setTokens(access, data.refreshToken);
}

export async function registerRequest(body: {
  email: string;
  password: string;
  organizationName: string;
}): Promise<RegisterResponse> {
  return apiJson<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function verifyEmailRequest(token: string): Promise<LoginResponse> {
  return apiJson<LoginResponse>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

/** Public: create tenant account + lease from invite link token. */
export async function acceptInvitationRequest(
  token: string,
  password: string
): Promise<AcceptInvitationResponse> {
  return apiJson<AcceptInvitationResponse>("/invitations/accept", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function forgotPasswordRequest(email: string): Promise<{ message: string }> {
  return apiJson<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPasswordRequest(
  token: string,
  password: string
): Promise<{ message: string }> {
  return apiJson<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function fetchMe(): Promise<MeResponse> {
  return apiJson<MeResponse>("/auth/me");
}

export async function logoutRequest(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    const res = await apiFetch("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: refreshToken ?? undefined }),
    });
    if (!res.ok && res.status !== 204) {
      // still clear local session
    }
  } finally {
    clearTokens();
  }
}
