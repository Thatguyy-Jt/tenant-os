import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ApiError } from "@/api/client";
import { listLeases } from "@/api/staffApi";
import { formatDate, formatMoney } from "@/lib/format";

export function LeasesListPage() {
  const q = useQuery({
    queryKey: ["staff", "leases"],
    queryFn: listLeases,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Leases</h1>
        <p className="mt-1 text-sm text-muted-foreground">Active and past leases across your portfolio.</p>
      </div>

      {q.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : q.isError ? (
        <p className="text-destructive">
          {q.error instanceof ApiError ? q.error.message : "Could not load leases."}
        </p>
      ) : !q.data?.length ? (
        <p className="text-muted-foreground">No leases yet. Invite a tenant to a vacant unit.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Rent</th>
                <th className="px-4 py-3 font-medium">Term</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {q.data.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to={`/staff/leases/${l.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                      {l.tenantEmail ?? l.tenantUserId}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{l.unitLabel ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMoney(l.rentAmount, l.currency)} / {l.billingFrequency}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(l.startDate)}
                    {l.endDate ? ` — ${formatDate(l.endDate)}` : " — open"}
                  </td>
                  <td className="px-4 py-3 capitalize">{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
