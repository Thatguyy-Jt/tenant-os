const DEFAULT_API = "http://localhost:4000/api/v1";

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API;
  return raw.replace(/\/$/, "");
}
