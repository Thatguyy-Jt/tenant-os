import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Home,
  CreditCard,
  Wrench,
  FileText,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ThemePicker } from "@/components/ThemePicker";

const navItems = [
  { to: "/tenant", end: true, icon: Home, label: "Home" },
  { to: "/tenant/payments", end: false, icon: CreditCard, label: "Payments" },
  { to: "/tenant/maintenance", end: false, icon: Wrench, label: "Maintenance" },
  { to: "/tenant/documents", end: false, icon: FileText, label: "Documents" },
];

function UserAvatar({ email }: { email?: string }) {
  const initials = email ? email[0].toUpperCase() : "T";
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary ring-2 ring-primary/30">
      {initials}
    </div>
  );
}

export function TenantLayout() {
  const { user, organization, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const currentPage = navItems.find((n) =>
    n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ─── Desktop Sidebar ─── */}
      <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-border/60 bg-card/50 backdrop-blur-sm md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-border/50 px-5">
          <Link to="/tenant" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary font-bold text-xs">
              T
            </div>
            <span className="font-heading text-base font-bold text-foreground">
              {organization?.name ?? "TenantOS"}
            </span>
          </Link>
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            Tenant
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 p-3 pt-4">
          {navItems.map(({ to, end, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/12 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? "text-primary" : ""} />
                  <span>{label}</span>
                  {isActive && <ChevronRight size={13} className="ml-auto opacity-50" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <UserAvatar email={user?.email} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{user?.email}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemePicker />
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start gap-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => void logout()}
            >
              <LogOut size={13} />
              Log out
            </Button>
          </div>
        </div>
      </aside>

      {/* ─── Mobile header ─── */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border/60 bg-card/50 px-4 backdrop-blur-sm md:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <span className="font-heading text-sm font-bold">
              {currentPage?.label ?? "TenantOS"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemePicker />
            <UserAvatar email={user?.email} />
          </div>
        </header>

        {/* Mobile slide-over */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative z-10 flex w-64 flex-col border-r border-border bg-card shadow-2xl">
              <div className="flex h-14 items-center justify-between border-b border-border/50 px-4">
                <span className="font-heading text-base font-bold">
                  {organization?.name ?? "TenantOS"}
                </span>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/60"
                  onClick={() => setMobileOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 space-y-0.5 p-3">
                {navItems.map(({ to, end, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                        isActive
                          ? "bg-primary/12 text-primary"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )
                    }
                  >
                    <Icon size={16} />
                    {label}
                  </NavLink>
                ))}
              </nav>
              <div className="border-t border-border/50 p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <UserAvatar email={user?.email} />
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => void logout()}
                >
                  <LogOut size={13} />
                  Log out
                </Button>
              </div>
            </aside>
          </div>
        )}

        <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
          {/* Page breadcrumb bar */}
          <div className="hidden md:flex items-center gap-2 border-b border-border/40 bg-background/60 px-6 py-2.5 text-xs text-muted-foreground">
            <Bell size={12} />
            <span>{organization?.name ?? "TenantOS"}</span>
            <ChevronRight size={11} />
            <span className="text-foreground font-medium">{currentPage?.label ?? "Dashboard"}</span>
          </div>
          <div className="container py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
