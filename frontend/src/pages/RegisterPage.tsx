import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

import { ApiError } from "@/api/client";
import { registerRequest } from "@/api/authApi";
import { isRegisterWithImmediateAuth } from "@/api/types";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const inputClass =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring focus:ring-2";

const passwordInputClass =
  "w-full rounded-md border border-input bg-background py-2 pl-3 pr-10 text-sm text-foreground outline-none ring-ring focus:ring-2";

export function RegisterPage() {
  const { user, setSessionFromAuthResponse } = useAuth();
  const navigate = useNavigate();
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (user) {
    return <Navigate to={user.role === "tenant" ? "/tenant" : "/staff"} replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
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
      const res = await registerRequest({
        email: email.trim(),
        password,
        organizationName: organizationName.trim(),
      });
      if (isRegisterWithImmediateAuth(res)) {
        await setSessionFromAuthResponse(res);
        navigate("/staff", { replace: true });
        return;
      }
      setSuccessMessage(res.message);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Registration failed. Try again.");
      }
    } finally {
      setPending(false);
    }
  }

  if (successMessage) {
    return (
      <div className="flex min-h-screen flex-col bg-background px-4 text-foreground">
        <main id="main-content" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16" tabIndex={-1}>
          <Link to="/" className="mb-8 text-center font-heading text-xl font-bold">
            Tenant<span className="text-primary">OS</span>
          </Link>
          <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-foreground">
            {successMessage}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              Go to sign in
            </Link>{" "}
            after you verify your email.
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
        <h1 className="font-heading text-2xl font-semibold">Create your organization</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
          {error ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div>
            <label htmlFor="org" className="text-sm font-medium">
              Organization name
            </label>
            <input
              id="org"
              type="text"
              autoComplete="organization"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className={inputClass}
            />
          </div>
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
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="password"
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
            <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <div>
            <label htmlFor="confirm" className="text-sm font-medium">
              Confirm password
            </label>
            <div className="relative mt-1">
              <input
                id="confirm"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={passwordInputClass}
              />
              <button
                type="button"
                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                onClick={() => setShowConfirmPassword((s) => !s)}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </main>
    </div>
  );
}
