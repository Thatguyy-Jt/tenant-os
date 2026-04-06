/** Local Vite dev server → local API. Production build → Render API unless VITE_API_BASE_URL overrides. */
const DEFAULT_API_DEV = "http://localhost:4000/api/v1";
const DEFAULT_API_PROD = "https://tenant-os.onrender.com/api/v1";

export function getApiBaseUrl(): string {
  const fallback = import.meta.env.PROD ? DEFAULT_API_PROD : DEFAULT_API_DEV;
  const raw = import.meta.env.VITE_API_BASE_URL ?? fallback;
  return raw.replace(/\/$/, "");
}
