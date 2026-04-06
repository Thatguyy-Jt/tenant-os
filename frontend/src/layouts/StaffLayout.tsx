import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, Outlet } from "react-router-dom";

import { listNotifications } from "@/api/staffApi";
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

export function StaffLayout() {
  const { user, organization, logout } = useAuth();

  const { data: notifBadge } = useQuery({
    queryKey: ["staff", "notifications", "badge"],
    queryFn: () => listNotifications({ limit: 1, unreadOnly: true }),
    staleTime: 45_000,
    refetchInterval: 120_000,
  });
  const unread = notifBadge?.unreadCount ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/staff" className="font-heading text-lg font-semibold">
              {organization?.name ?? "TenantOS"}
            </Link>
            {user?.role === "agent" ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Agent
              </span>
            ) : null}
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/staff" end className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/staff/properties" className={navLinkClass}>
              Properties
            </NavLink>
            <NavLink to="/staff/leases" className={navLinkClass}>
              Leases
            </NavLink>
            <NavLink to="/staff/invitations" className={navLinkClass}>
              Invitations
            </NavLink>
            <NavLink to="/staff/maintenance" className={navLinkClass}>
              Maintenance
            </NavLink>
            <NavLink to="/staff/notifications" className={navLinkClass}>
              <span className="inline-flex items-center gap-1.5">
                Notifications
                {unread > 0 ? (
                  <span className="rounded-full bg-primary px-1.5 py-0 text-[10px] font-semibold text-primary-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </span>
            </NavLink>
            {user?.role === "landlord" ? (
              <NavLink to="/staff/settings" className={navLinkClass}>
                Settings
              </NavLink>
            ) : null}
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
