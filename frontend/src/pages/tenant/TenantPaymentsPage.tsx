import { useMutation, useQuery } from "@tanstack/react-query";

import { ApiError } from "@/api/client";
import { downloadRentReceiptPdf, getTenantLease, getTenantPayments } from "@/api/tenantApi";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatMoney } from "@/lib/format";

export function TenantPaymentsPage() {
  const leaseQuery = useQuery({
    queryKey: ["tenant", "lease"],
    queryFn: getTenantLease,
    retry: false,
  });

  const paymentsQuery = useQuery({
    queryKey: ["tenant", "payments"],
    queryFn: getTenantPayments,
    enabled: leaseQuery.isSuccess,
  });

  const receiptMut = useMutation({
    mutationFn: (paymentId: string) => downloadRentReceiptPdf(paymentId),
    onSuccess: (blob, paymentId) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tenantos-receipt-${paymentId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
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
          ? "No active lease found."
          : err instanceof ApiError
            ? err.message
            : "Could not load payments."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Rent payments recorded for your lease.</p>
      </div>

      {paymentsQuery.isLoading ? (
        <p className="text-muted-foreground">Loading payments…</p>
      ) : paymentsQuery.isError ? (
        <p className="text-destructive">Could not load payments.</p>
      ) : !paymentsQuery.data?.length ? (
        <p className="text-muted-foreground">No payments yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Paid at</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paymentsQuery.data.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(p.paidAt)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                  <td className="px-4 py-3 capitalize">{p.method}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={receiptMut.isPending}
                      onClick={() => receiptMut.mutate(p.id)}
                    >
                      PDF
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
