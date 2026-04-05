import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError } from "@/api/client";
import { listMaintenanceRequests, patchMaintenanceRequest } from "@/api/staffApi";
import { formatDateTime } from "@/lib/format";

const STATUSES = ["", "open", "in_progress", "resolved", "cancelled"] as const;

export function MaintenanceListPage() {
  const [status, setStatus] = useState<string>("");
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["staff", "maintenance", status || "all"],
    queryFn: () => listMaintenanceRequests(status || undefined),
  });

  const patchMut = useMutation({
    mutationFn: ({
      id,
      next,
    }: {
      id: string;
      next: "open" | "in_progress" | "resolved" | "cancelled";
    }) => patchMaintenanceRequest(id, { status: next }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", "maintenance"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Maintenance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Requests from tenants across your units.</p>
        </div>
        <div>
          <label htmlFor="maint-filter" className="text-sm font-medium">
            Status
          </label>
          <select
            id="maint-filter"
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {q.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : q.isError ? (
        <p className="text-destructive">
          {q.error instanceof ApiError ? q.error.message : "Could not load requests."}
        </p>
      ) : !q.data?.length ? (
        <p className="text-muted-foreground">No maintenance requests.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {q.data.map((r) => (
            <li key={r.id} className="px-4 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDateTime(r.createdAt)} · {r.priority} ·{" "}
                    <span className="capitalize">{r.status.replace("_", " ")}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.status !== "in_progress" ? (
                    <button
                      type="button"
                      className="rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-muted"
                      disabled={patchMut.isPending}
                      onClick={() => patchMut.mutate({ id: r.id, next: "in_progress" })}
                    >
                      In progress
                    </button>
                  ) : null}
                  {r.status !== "resolved" ? (
                    <button
                      type="button"
                      className="rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-muted"
                      disabled={patchMut.isPending}
                      onClick={() => patchMut.mutate({ id: r.id, next: "resolved" })}
                    >
                      Resolve
                    </button>
                  ) : null}
                  {r.status !== "cancelled" && r.status !== "resolved" ? (
                    <button
                      type="button"
                      className="rounded-md border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                      disabled={patchMut.isPending}
                      onClick={() => {
                        if (window.confirm("Cancel this request?")) {
                          patchMut.mutate({ id: r.id, next: "cancelled" });
                        }
                      }}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
