import type { RequestHandler } from "express";
import type { UserRole } from "../models/User";
import { httpError } from "./errorHandler";

/** Requires JWT (use after `authenticate`). Allows only listed roles. */
export function requireRole(...allowed: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    const auth = req.auth;
    if (!auth) {
      return next(httpError(401, "Not authenticated", "UNAUTHORIZED"));
    }
    if (!allowed.includes(auth.role)) {
      return next(httpError(403, "Forbidden for this role", "FORBIDDEN"));
    }
    next();
  };
}
