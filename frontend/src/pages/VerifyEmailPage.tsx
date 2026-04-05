import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { verifyEmailRequest } from "@/api/authApi";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function VerifyEmailPage() {
  const { user, setSessionFromAuthResponse } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (user && !token) {
    return <Navigate to={user.role === "tenant" ? "/tenant" : "/staff"} replace />;
  }

  async function onVerify() {
    if (!token) return;
    setError(null);
    setPending(true);
    try {
      const auth = await verifyEmailRequest(token);
      const u = await setSessionFromAuthResponse(auth);
      navigate(u.role === "tenant" ? "/tenant" : "/staff", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Verification failed.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 text-foreground">
      <main id="main-content" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16" tabIndex={-1}>
        <Link to="/" className="mb-8 text-center font-heading text-xl font-bold">
          Tenant<span className="text-primary">OS</span>
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Verify email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Confirm your email address to activate your account.
        </p>

        {token ? (
          <div className="mt-8 space-y-4">
            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <Button type="button" className="w-full" disabled={pending} onClick={() => void onVerify()}>
              {pending ? "Verifying…" : "Verify my email"}
            </Button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Missing token. Open the link from your verification email, or{" "}
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              sign in
            </Link>
            .
          </p>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link to="/login">Back to sign in</Link>
        </p>
      </main>
    </div>
  );
}
