import { Link, NavLink, Outlet } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
  );

export function TenantLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/tenant" className="font-heading text-lg font-semibold">
              TenantOS
            </Link>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Tenant
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/tenant" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/tenant/payments" className={navLinkClass}>
              Payments
            </NavLink>
            <NavLink to="/tenant/maintenance" className={navLinkClass}>
              Maintenance
            </NavLink>
            <NavLink to="/tenant/documents" className={navLinkClass}>
              Documents
            </NavLink>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="truncate text-muted-foreground">{user?.email}</span>
            <Button variant="outline" size="sm" type="button" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main id="main-content" className="container py-8" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
