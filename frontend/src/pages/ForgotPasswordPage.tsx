import { useState } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "@/api/client";
import { forgotPasswordRequest } from "@/api/authApi";
import { Button } from "@/components/ui/button";

const inputClass =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring focus:ring-2";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await forgotPasswordRequest(email.trim());
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col bg-background px-4 text-foreground">
        <main id="main-content" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16" tabIndex={-1}>
          <Link to="/" className="mb-8 text-center font-heading text-xl font-bold">
            Tenant<span className="text-primary">OS</span>
          </Link>
          <h1 className="font-heading text-2xl font-semibold">Check your email</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            If an account exists for <strong className="text-foreground">{email}</strong>, you will
            receive reset instructions shortly.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
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
        <h1 className="font-heading text-2xl font-semibold">Forgot password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send a reset link if an account exists.
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
          {error ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
