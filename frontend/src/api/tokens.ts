/** Exported for cross-tab `storage` listeners (same key as localStorage). */
export const ACCESS_TOKEN_STORAGE_KEY = "tenantos_access_token";
const ACCESS = ACCESS_TOKEN_STORAGE_KEY;
const REFRESH = "tenantos_refresh_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS, accessToken);
  localStorage.setItem(REFRESH, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}
