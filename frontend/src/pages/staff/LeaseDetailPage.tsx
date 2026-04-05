import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import {
  getLease,
  getLeaseBalance,
  listLeasePayments,
  recordLeasePayment,
} from "@/api/staffApi";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { fieldClass, labelClass } from "@/lib/staffUi";

export function LeaseDetailPage() {
  const { leaseId } = useParams<{ leaseId: string }>();
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const leaseQuery = useQuery({
    queryKey: ["staff", "lease", leaseId],
    queryFn: () => getLease(leaseId!),
    enabled: Boolean(leaseId),
  });

  const paymentsQuery = useQuery({
    queryKey: ["staff", "lease", leaseId, "payments"],
    queryFn: () => listLeasePayments(leaseId!),
    enabled: Boolean(leaseId),
  });

  const balanceQuery = useQuery({
    queryKey: ["staff", "lease", leaseId, "balance"],
    queryFn: () => getLeaseBalance(leaseId!),
    enabled: Boolean(leaseId),
  });

  const payMut = useMutation({
    mutationFn: (body: { amount: number; notes?: string; paidAt?: string }) =>
      recordLeasePayment(leaseId!, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", "lease", leaseId, "payments"] });
      void qc.invalidateQueries({ queryKey: ["staff", "lease", leaseId, "balance"] });
      void qc.invalidateQueries({ queryKey: ["staff", "dashboard"] });
      setFormError(null);
    },
    onError: (e: unknown) => {
      setFormError(e instanceof ApiError ? e.message : "Payment failed.");
    },
  });

  if (!leaseId) {
    return <p className="text-destructive">Missing lease.</p>;
  }

  const l = leaseQuery.data;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/staff/leases" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Leases
        </Link>
        {leaseQuery.isLoading ? (
          <p className="mt-4 text-muted-foreground">Loading…</p>
        ) : leaseQuery.isError ? (
          <p className="mt-4 text-destructive">
            {leaseQuery.error instanceof ApiError ? leaseQuery.error.message : "Lease not found."}
          </p>
        ) : l ? (
          <>
            <h1 className="mt-4 font-heading text-2xl font-bold">Lease</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {l.tenantEmail} · {l.unitLabel ?? "Unit"} · {formatMoney(l.rentAmount, l.currency)} /{" "}
              {l.billingFrequency}
            </p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Start</dt>
                <dd>{formatDate(l.startDate)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">End</dt>
                <dd>{l.endDate ? formatDate(l.endDate) : "Open-ended"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="capitalize">{l.status}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </div>

      {balanceQuery.data ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-heading text-lg font-semibold">Balance</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            As of {formatDateTime(balanceQuery.data.asOf)}
          </p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Expected</dt>
              <dd className="tabular-nums">{formatMoney(balanceQuery.data.expectedTotal, balanceQuery.data.currency)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="tabular-nums">{formatMoney(balanceQuery.data.totalPaid, balanceQuery.data.currency)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Balance</dt>
              <dd
                className={
                  balanceQuery.data.balance > 0 ? "font-semibold text-destructive tabular-nums" : "tabular-nums"
                }
              >
                {formatMoney(balanceQuery.data.balance, balanceQuery.data.currency)}
              </dd>
            </div>
          </dl>
        </div>
      ) : balanceQuery.isLoading ? (
        <p className="text-muted-foreground">Loading balance…</p>
      ) : null}

      <div>
        <h2 className="font-heading text-lg font-semibold">Record payment</h2>
        <form
          className="mt-4 max-w-md space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const amount = Number(fd.get("amount"));
            const notes = (fd.get("notes") as string)?.trim();
            const paidRaw = (fd.get("paidAt") as string)?.trim();
            if (Number.isNaN(amount) || amount <= 0) {
              setFormError("Enter a valid amount.");
              return;
            }
            payMut.mutate({
              amount,
              notes: notes || undefined,
              paidAt: paidRaw ? new Date(paidRaw).toISOString() : undefined,
            });
            e.currentTarget.reset();
          }}
        >
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div>
            <label className={labelClass} htmlFor="pay-amt">
              Amount
            </label>
            <input
              id="pay-amt"
              name="amount"
              type="number"
              min={0.01}
              step="0.01"
              required
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="pay-when">
              Paid at (optional)
            </label>
            <input id="pay-when" name="paidAt" type="datetime-local" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="pay-notes">
              Notes
            </label>
            <input id="pay-notes" name="notes" className={fieldClass} />
          </div>
          <Button type="submit" disabled={payMut.isPending}>
            {payMut.isPending ? "Recording…" : "Record manual payment"}
          </Button>
        </form>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold">Payments</h2>
        {paymentsQuery.isLoading ? (
          <p className="mt-2 text-muted-foreground">Loading…</p>
        ) : paymentsQuery.isError ? (
          <p className="mt-2 text-destructive">Could not load payments.</p>
        ) : !paymentsQuery.data?.length ? (
          <p className="mt-2 text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Paid at</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paymentsQuery.data.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(p.paidAt)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                    <td className="px-4 py-3">{p.method}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
