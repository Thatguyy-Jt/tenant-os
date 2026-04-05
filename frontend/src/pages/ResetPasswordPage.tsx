import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { resetPasswordRequest } from "@/api/authApi";
import { Button } from "@/components/ui/button";

const inputClass =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring focus:ring-2";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      await resetPasswordRequest(token, password);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Could not reset password.");
      }
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col bg-background px-4 text-foreground">
        <main id="main-content" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16" tabIndex={-1}>
          <Link to="/" className="mb-8 text-center font-heading text-xl font-bold">
            Tenant<span className="text-primary">OS</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            Invalid or missing reset link.{" "}
            <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">
              Request a new one
            </Link>
            .
          </p>
        </main>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col bg-background px-4 text-foreground">
        <main id="main-content" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16" tabIndex={-1}>
          <Link to="/" className="mb-8 text-center font-heading text-xl font-bold">
            Tenant<span className="text-primary">OS</span>
          </Link>
          <h1 className="font-heading text-2xl font-semibold">Password updated</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            You can now sign in with your new password.
          </p>
          <Button asChild className="mt-8 w-full">
            <Link to="/login">Sign in</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 text-foreground">
      <main id="main-content" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16" tabIndex={-1}>
        <Link to="/" className="mb-8 text-center font-heading text-xl font-bold">
          Tenant<span className="text-primary">OS</span>
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Set new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose a strong password for your account.</p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
          {error ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirm" className="text-sm font-medium">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Updating…" : "Update password"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/login">Back to sign in</Link>
        </p>
      </main>
    </div>
  );
}
