import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/api/client";
import { createTenantMaintenanceRequest, getTenantLease, listTenantMaintenanceRequests } from "@/api/tenantApi";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { fieldClass, labelClass } from "@/lib/staffUi";

export function TenantMaintenancePage() {
  const qc = useQueryClient();

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
    },
  });

  if (leaseQuery.isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (leaseQuery.isError) {
    const err = leaseQuery.error;
    return (
      <p className="text-destructive">
        {err instanceof ApiError && err.status === 404
          ? "No active lease — maintenance requests require an active lease."
          : err instanceof ApiError
            ? err.message
            : "Error."}
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-10">
      <header className="w-full text-center">
        <h1 className="font-heading text-2xl font-bold">Maintenance</h1>
        <p className="mt-1 text-sm text-muted-foreground">Report issues for your unit. Staff will update the status.</p>
      </header>

      <form
        className="w-full max-w-xl space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const title = (fd.get("title") as string).trim();
          const description = (fd.get("description") as string).trim();
          const priority = fd.get("priority") as "low" | "normal" | "high";
          if (!title || !description) return;
          createMut.mutate({ title, description, priority });
          e.currentTarget.reset();
        }}
      >
        <h2 className="font-heading text-lg font-semibold">New request</h2>
        {createMut.isError ? (
          <p className="text-sm text-destructive">
            {createMut.error instanceof ApiError ? createMut.error.message : "Could not submit."}
          </p>
        ) : null}
        <div>
          <label className={labelClass} htmlFor="m-title">
            Title
          </label>
          <input id="m-title" name="title" required maxLength={200} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="m-desc">
            Description
          </label>
          <textarea id="m-desc" name="description" required rows={4} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="m-pri">
            Priority
          </label>
          <select id="m-pri" name="priority" className={fieldClass} defaultValue="normal">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </div>
        <Button type="submit" disabled={createMut.isPending}>
          {createMut.isPending ? "Submitting…" : "Submit request"}
        </Button>
      </form>

      <div className="w-full max-w-xl">
        <h2 className="text-center font-heading text-lg font-semibold">Your requests</h2>
        {listQuery.isLoading ? (
          <p className="mt-2 text-center text-muted-foreground">Loading…</p>
        ) : listQuery.isError ? (
          <p className="mt-2 text-center text-destructive">Could not load requests.</p>
        ) : !listQuery.data?.length ? (
          <p className="mt-2 text-center text-muted-foreground">No requests yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {listQuery.data.map((r) => (
              <li key={r.id} className="px-4 py-4">
                <p className="font-medium">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDateTime(r.createdAt)} · {r.priority} ·{" "}
                  <span className="capitalize">{r.status.replace("_", " ")}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
