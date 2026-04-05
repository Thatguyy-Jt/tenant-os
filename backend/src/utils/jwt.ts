import jwt, { type SignOptions } from "jsonwebtoken";
import type { UserRole } from "../models/User";

export type JwtPayload = {
  sub: string;
  organizationId: string;
  role: UserRole;
};

export function signAccessToken(
  payload: JwtPayload,
  secret: string,
  expiresIn: string
): string {
  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions["expiresIn"],
  };
  return jwt.sign(
    {
      sub: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role,
    },
    secret,
    options
  );
}

export function verifyAccessToken(token: string, secret: string): JwtPayload {
  const decoded = jwt.verify(token, secret) as jwt.JwtPayload & JwtPayload;
  if (!decoded.sub || !decoded.organizationId || !decoded.role) {
    throw new Error("Invalid token payload");
  }
  return {
    sub: decoded.sub,
    organizationId: decoded.organizationId,
    role: decoded.role,
  };
}
