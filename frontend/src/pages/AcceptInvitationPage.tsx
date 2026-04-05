import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

import { ApiError } from "@/api/client";
import { acceptInvitationRequest } from "@/api/authApi";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const passwordInputClass =
  "w-full rounded-md border border-input bg-background py-2 pl-3 pr-10 text-sm text-foreground outline-none ring-ring focus:ring-2";

export function AcceptInvitationPage() {
  const { user, setSessionFromAuthResponse, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (user?.role === "tenant") {
    return <Navigate to="/tenant" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Missing invitation token in the link.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const auth = await acceptInvitationRequest(token, password);
      const u = await setSessionFromAuthResponse(auth);
      navigate(u.role === "tenant" ? "/tenant" : "/staff", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Could not complete invitation. Try again.");
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
        <h1 className="font-heading text-2xl font-semibold">Accept invitation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set a password for your tenant account. This completes your lease setup.
        </p>

        {user ? (
          <div className="mt-8 space-y-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-foreground">
            <p>You’re signed in as {user.role}. Sign out first to accept a tenant invitation.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        ) : null}

        {token ? (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <div>
              <label htmlFor="inv-pw" className="text-sm font-medium">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="inv-pw"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={passwordInputClass}
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="inv-pw2" className="text-sm font-medium">
                Confirm password
              </label>
              <div className="relative mt-1">
                <input
                  id="inv-pw2"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={passwordInputClass}
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={() => setShowConfirm((s) => !s)}
                  aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={pending || !!user}>
              {pending ? "Creating account…" : "Create account & open portal"}
            </Button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Missing <code className="rounded bg-muted px-1 py-0.5 text-xs">token</code> in the URL. Use the link from
            your invitation email, or{" "}
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              sign in
            </Link>{" "}
            if you already registered.
          </p>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link to="/login">Back to sign in</Link>
        </p>
      </main>
    </div>
  );
}
