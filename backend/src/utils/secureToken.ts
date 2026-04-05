import { createHash, randomBytes } from "crypto";

/** Random opaque token (only sent to user once). */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** Store only SHA-256 hex digest of secrets (verification, reset, refresh). */
export function hashOpaqueToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}
