import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench, Plus, Clock, CheckCircle2, AlertTriangle, Circle, ChevronDown } from "lucide-react";

import { ApiError } from "@/api/client";
import { createTenantMaintenanceRequest, getTenantLease, listTenantMaintenanceRequests } from "@/api/tenantApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { fieldClass, labelClass } from "@/lib/staffUi";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  open: {
    label: "Open",
    icon: <Circle size={12} />,
    className: "bg-primary/15 text-primary",
  },
  in_progress: {
    label: "In Progress",
    icon: <Clock size={12} />,
    className: "bg-amber-500/15 text-amber-500",
  },
  resolved: {
    label: "Resolved",
    icon: <CheckCircle2 size={12} />,
    className: "bg-emerald-500/15 text-emerald-500",
  },
  cancelled: {
    label: "Cancelled",
    icon: <Circle size={12} />,
    className: "bg-muted text-muted-foreground",
  },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-muted/60 text-muted-foreground" },
  normal: { label: "Normal", className: "bg-primary/10 text-primary" },
  high: { label: "High", className: "bg-destructive/15 text-destructive" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    icon: <Circle size={12} />,
    className: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] ?? { label: priority, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export function TenantMaintenancePage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const leaseQuery = useQuery({
    queryKey: ["tenant", "lease"],
    queryFn: getTenantLease,
    retry: false,
  });

  const listQuery = useQuery({
    queryKey: ["tenant", "maintenance"],
    queryFn: listTenantMaintenanceRequests,
    enabled: leaseQuery.isSuccess,
  });

  const createMut = useMutation({
    mutationFn: createTenantMaintenanceRequest,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tenant", "maintenance"] });
      setShowForm(false);
    },
  });

  if (leaseQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-muted/50" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted/50" />
      </div>
    );
  }

  if (leaseQuery.isError) {
    const err = leaseQuery.error;
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
        {err instanceof ApiError && err.status === 404
          ? "No active lease — maintenance requests require an active lease."
          : err instanceof ApiError ? err.message : "Error."}
      </div>
    );
  }

  const requests = listQuery.data ?? [];
  const openCount = requests.filter((r) => r.status === "open" || r.status === "in_progress").length;
  const resolvedCount = requests.filter((r) => r.status === "resolved").length;

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Wrench size={22} />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Maintenance</h1>
            <p className="text-sm text-muted-foreground">Report and track issues with your unit</p>
          </div>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="gap-2 self-start sm:self-auto">
          <Plus size={15} />
          {showForm ? "Cancel" : "New Request"}
        </Button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">Total</CardDescription>
            <CardTitle className="text-2xl font-bold">{requests.length}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">All requests</p></CardContent>
        </Card>
        <Card className={openCount > 0 ? "border-amber-500/30 bg-amber-500/5" : ""}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">Active</CardDescription>
            <CardTitle className={`text-2xl font-bold ${openCount > 0 ? "text-amber-500" : ""}`}>{openCount}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">Open or in progress</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">Resolved</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-500">{resolvedCount}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">Fixed issues</p></CardContent>
        </Card>
      </div>

      {/* ── New request form ── */}
      {showForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base font-semibold">New Maintenance Request</CardTitle>
            <CardDescription className="text-xs">Describe the issue — staff will update the status once reviewed</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const title = (fd.get("title") as string).trim();
                const description = (fd.get("description") as string).trim();
                const priority = fd.get("priority") as "low" | "normal" | "high";
                if (!title || !description) return;
                createMut.mutate({ title, description, priority });
              }}
            >
              {createMut.isError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle size={14} className="shrink-0" />
                  {createMut.error instanceof ApiError ? createMut.error.message : "Could not submit."}
                </div>
              )}
              <div>
                <label className={labelClass} htmlFor="m-title">Title</label>
                <input id="m-title" name="title" required maxLength={200} className={fieldClass} placeholder="e.g. Leaking tap in bathroom" />
              </div>
              <div>
                <label className={labelClass} htmlFor="m-desc">Description</label>
                <textarea id="m-desc" name="description" required rows={4} className={fieldClass} placeholder="Describe the issue in detail..." />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="m-pri">Priority</label>
                  <div className="relative">
                    <select id="m-pri" name="priority" className={`${fieldClass} appearance-none pr-8`} defaultValue="normal">
                      <option value="low">Low — minor inconvenience</option>
                      <option value="normal">Normal — needs attention</option>
                      <option value="high">High — urgent / safety issue</option>
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={createMut.isPending} className="gap-2">
                  <Plus size={14} />
                  {createMut.isPending ? "Submitting…" : "Submit Request"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Requests list ── */}
      <div>
        <h2 className="mb-4 font-heading text-base font-semibold">Your Requests</h2>
        {listQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/50" />)}
          </div>
        ) : listQuery.isError ? (
          <p className="text-sm text-destructive">Could not load requests.</p>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 py-16 text-center">
            <div className="rounded-full bg-muted/50 p-4">
              <Wrench size={24} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">No requests yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Click "New Request" above to report an issue</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <Card key={r.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={r.status} />
                        <PriorityBadge priority={r.priority} />
                      </div>
                      <h3 className="font-semibold text-foreground">{r.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{r.description}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground border-t border-border/50 pt-3">
                    Submitted {formatDateTime(r.createdAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
