import { createHash, randomBytes } from "crypto";

/** Opaque token sent in the email; only a SHA-256 digest is stored. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashInviteToken(plainToken: string): string {
  return createHash("sha256").update(plainToken, "utf8").digest("hex");
}
