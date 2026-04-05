import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";

function LoadingScreen() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-background text-muted-foreground">
      Loading…
    </div>
  );
}

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RequireStaff() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === "tenant") {
    return <Navigate to="/tenant" replace />;
  }
  return <Outlet />;
}

export function RequireTenant() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== "tenant") {
    return <Navigate to="/staff" replace />;
  }
  return <Outlet />;
}

/** Organization settings and other landlord-only staff routes. */
export function RequireLandlord() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== "landlord") {
    return <Navigate to="/staff" replace />;
  }
  return <Outlet />;
}
