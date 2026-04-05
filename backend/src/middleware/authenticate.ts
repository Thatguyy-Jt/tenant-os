import type { RequestHandler } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { loadEnv } from "../config/env";
import { httpError } from "./errorHandler";

const bearer = /^Bearer\s+(.+)$/i;

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    return next(httpError(401, "Missing Authorization header", "UNAUTHORIZED"));
  }
  const match = bearer.exec(header);
  const token = match?.[1];
  if (!token) {
    return next(httpError(401, "Invalid Authorization header", "UNAUTHORIZED"));
  }
  try {
    const env = loadEnv();
    const payload = verifyAccessToken(token, env.JWT_SECRET);
    req.auth = {
      userId: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role,
    };
    next();
  } catch {
    next(httpError(401, "Invalid or expired token", "UNAUTHORIZED"));
  }
};
