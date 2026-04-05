import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

type ApiError = Error & { status?: number; code?: string };

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message },
    });
    return;
  }

  const status = typeof err.status === "number" ? err.status : 500;
  const code = typeof err.code === "string" ? err.code : "INTERNAL_ERROR";
  const message =
    status === 500 && process.env.NODE_ENV === "production"
      ? "Something went wrong"
      : err.message || "Something went wrong";

  if (process.env.NODE_ENV !== "test") {
    console.error(err);
  }

  res.status(status).json({
    error: { code, message },
  });
};

export function httpError(status: number, message: string, code?: string): ApiError {
  const e: ApiError = new Error(message);
  e.status = status;
  e.code = code ?? "HTTP_ERROR";
  return e;
}
