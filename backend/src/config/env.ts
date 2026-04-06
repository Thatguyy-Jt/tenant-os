import { z } from "zod";

const optionalNonEmpty = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().positive().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  /** Short-lived access JWT (e.g. 15m). Falls back to JWT_EXPIRES_IN if unset. */
  JWT_ACCESS_EXPIRES_IN: z.preprocess((v) => {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    const legacy = process.env.JWT_EXPIRES_IN;
    if (typeof legacy === "string" && legacy.trim() !== "") return legacy.trim();
    return "15m";
  }, z.string().min(1)),
  /** Refresh session length in days (opaque token stored hashed server-side). */
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().positive().max(365).default(7),
  /** @deprecated Prefer JWT_ACCESS_EXPIRES_IN — still read as fallback for access token TTL */
  JWT_EXPIRES_IN: z.string().optional(),
  EMAIL_VERIFICATION_EXPIRES_HOURS: z.coerce.number().positive().max(168).default(24),
  PASSWORD_RESET_EXPIRES_MINUTES: z.coerce.number().positive().max(1440).default(60),
  /**
   * When true: registration sends a verification email and login is blocked until verified.
   * Default false for local/dev. Set to true in production when email delivery is configured.
   * Tests (NODE_ENV=test) always skip the verification flow regardless of this flag.
   */
  REQUIRE_EMAIL_VERIFICATION: z
    .preprocess((v) => {
      if (v === undefined || v === "") return false;
      if (typeof v === "string") return v === "true" || v === "1";
      return Boolean(v);
    }, z.boolean())
    .default(false),
  /** Base URL for invite links (no trailing slash). Defaults: prod → Vercel app, dev → localhost:5173 */
  APP_PUBLIC_URL: z.preprocess(
    (val) => {
      if (typeof val === "string" && val.trim() !== "") return val.trim();
      return process.env.NODE_ENV === "production"
        ? "https://tenantos.vercel.app"
        : "http://localhost:5173";
    },
    z.string().url()
  ),
  /** Browser origin for CORS. Defaults to Vercel app in production; if unset in dev, any origin is allowed. */
  FRONTEND_ORIGIN: z.preprocess(
    (val) => {
      if (typeof val === "string" && val.trim() !== "") return val.trim();
      if (process.env.NODE_ENV === "production") return "https://tenantos.vercel.app";
      return undefined;
    },
    z.string().url().optional()
  ),
  INVITE_EXPIRES_DAYS: z.coerce.number().positive().max(90).default(7),
  /** Resend API key (HTTPS) — preferred on cloud hosts vs SMTP. https://resend.com/api-keys */
  RESEND_API_KEY: optionalNonEmpty,
  /** SMTP fallback when RESEND_API_KEY is unset (e.g. local dev). */
  SMTP_HOST: optionalNonEmpty,
  SMTP_PORT: z.coerce.number().positive().default(587),
  SMTP_SECURE: z
    .string()
    .default("false")
    .transform((s) => s === "true" || s === "1"),
  SMTP_USER: optionalNonEmpty,
  SMTP_PASS: optionalNonEmpty,
  EMAIL_FROM: z.string().min(1).default("TenantOS <noreply@localhost>"),
  /** Paystack — https://dashboard.paystack.com/#/settings/developer */
  PAYSTACK_SECRET_KEY: optionalNonEmpty,
  /** Redis for Bull job queue (rent reminders). If unset, reminders are disabled. */
  REDIS_URL: optionalNonEmpty,
  /** Cloudinary — https://cloudinary.com/console */
  CLOUDINARY_CLOUD_NAME: optionalNonEmpty,
  CLOUDINARY_API_KEY: optionalNonEmpty,
  CLOUDINARY_API_SECRET: optionalNonEmpty,
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Clears parsed env cache (used in tests after mutating `process.env`). */
export function resetEnvCache(): void {
  cached = null;
}

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(msg)}`);
  }
  cached = parsed.data;
  return cached;
}
