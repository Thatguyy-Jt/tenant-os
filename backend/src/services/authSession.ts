import mongoose from "mongoose";
import { loadEnv } from "../config/env";
import { RefreshToken } from "../models/RefreshToken";
import { User } from "../models/User";
import { generateOpaqueToken, hashOpaqueToken } from "../utils/secureToken";

export async function issueRefreshToken(userId: mongoose.Types.ObjectId): Promise<string> {
  const env = loadEnv();
  const raw = generateOpaqueToken(48);
  const tokenHash = hashOpaqueToken(raw);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRES_DAYS);

  await RefreshToken.create({
    userId,
    tokenHash,
    expiresAt,
  });

  return raw;
}

/** Validates refresh token, removes it (one-time rotation), returns userId. */
export async function consumeRefreshToken(rawToken: string): Promise<mongoose.Types.ObjectId | null> {
  const tokenHash = hashOpaqueToken(rawToken);
  const doc = await RefreshToken.findOneAndDelete({
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  return doc ? (doc.userId as mongoose.Types.ObjectId) : null;
}

export async function revokeRefreshToken(rawToken: string): Promise<boolean> {
  const tokenHash = hashOpaqueToken(rawToken);
  const res = await RefreshToken.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return res.modifiedCount > 0;
}

export async function revokeAllRefreshTokensForUser(userId: mongoose.Types.ObjectId): Promise<void> {
  await RefreshToken.deleteMany({ userId });
}

export async function buildAuthResponse(user: InstanceType<typeof User>) {
  const env = loadEnv();
  const { signAccessToken } = await import("../utils/jwt");
  const accessToken = signAccessToken(
    {
      sub: user._id.toString(),
      organizationId: user.organizationId.toString(),
      role: user.role,
    },
    env.JWT_SECRET,
    env.JWT_ACCESS_EXPIRES_IN
  );
  const refreshToken = await issueRefreshToken(user._id);
  const expiresInSec = parseExpiresToSeconds(env.JWT_ACCESS_EXPIRES_IN);
  return {
    token: accessToken,
    accessToken,
    refreshToken,
    expiresIn: expiresInSec,
    user: {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      organizationId: user.organizationId.toString(),
      emailVerified: user.emailVerified !== false,
    },
  };
}

function parseExpiresToSeconds(expiresIn: string): number {
  const m = /^(\d+)([smhd])$/i.exec(expiresIn.trim());
  if (!m) return 900;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  if (u === "s") return n;
  if (u === "m") return n * 60;
  if (u === "h") return n * 3600;
  if (u === "d") return n * 86400;
  return 900;
}
