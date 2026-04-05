import type { LeaseDto } from "./staffTypes";

export type UserRole = "landlord" | "agent" | "tenant";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  emailVerified: boolean;
};

export type OrganizationSummary = {
  id: string;
  name: string;
  defaultCurrency: string;
};

export type MeResponse = {
  user: AuthUser;
  organization: OrganizationSummary | null;
};

export type LoginResponse = {
  token: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
};

/** Public POST /invitations/accept — session + created lease. */
export type AcceptInvitationResponse = LoginResponse & {
  lease: LeaseDto;
};

export type ApiErrorBody = {
  error?: { code?: string; message?: string };
};

/** Register in production: email verification required (no tokens). In NODE_ENV=test, tokens may be returned. */
export type RegisterAwaitingVerification = {
  message: string;
  user: AuthUser;
  organization: { id: string; name: string };
};

export type RegisterWithAuthResponse = LoginResponse & {
  organization: { id: string; name: string };
};

export type RegisterResponse = RegisterAwaitingVerification | RegisterWithAuthResponse;

export function isRegisterWithImmediateAuth(
  r: RegisterResponse
): r is RegisterWithAuthResponse {
  return "accessToken" in r && Boolean(r.accessToken);
}
