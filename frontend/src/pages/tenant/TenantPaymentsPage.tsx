import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { CreditCard, Download, CheckCircle2, Clock, Banknote } from "lucide-react";

import { ApiError } from "@/api/client";
import { downloadRentReceiptPdf, getTenantLease, getTenantPayments } from "@/api/tenantApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { RentPaymentDto } from "@/api/staffTypes";

function cssVar(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return "#22d3ee";
  if (/^\d/.test(raw)) return `hsl(${raw})`;
  return raw;
}

// Aggregate payments into monthly buckets for the chart
function buildMonthlyChart(payments: RentPaymentDto[]) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const map = new Map<string, { month: string; amount: number; count: number }>();

  for (const p of payments) {
    const d = new Date(p.paidAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    const existing = map.get(key);
    if (existing) {
      existing.amount += p.amount;
      existing.count += 1;
    } else {
      map.set(key, { month: label, amount: p.amount, count: 1 });
    }
  }

  // Sort chronologically and take last 12
  const sorted = [...map.entries()]
    .sort(([a], [b]) => {
      const [ay, am] = a.split("-").map(Number);
      const [by, bm] = b.split("-").map(Number);
      return ay !== by ? ay - by : am - bm;
    })
    .map(([, v]) => v)
    .slice(-12);

  return sorted;
}

const METHOD_LABELS: Record<string, string> = {
  paystack: "Paystack",
  manual: "Manual",
};

const METHOD_COLORS: Record<string, string> = {
  paystack: "bg-primary/15 text-primary",
  manual: "bg-secondary text-secondary-foreground",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-popover px-4 py-3 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-foreground text-sm">{label}</p>
      <p style={{ color: payload[0]?.fill }}>
        Paid: {formatMoney(payload[0]?.value as number, currency)}
      </p>
      <p className="text-muted-foreground">{payload[0]?.payload?.count} payment{payload[0]?.payload?.count !== 1 ? "s" : ""}</p>
    </div>
  );
}

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
    return (
      <div className="space-y-4">
        <div className="h-64 animate-pulse rounded-2xl bg-muted/50" />
        <div className="h-96 animate-pulse rounded-2xl bg-muted/50" />
      </div>
    );
  }

  if (leaseQuery.isError) {
    const err = leaseQuery.error;
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
        {err instanceof ApiError && err.status === 404
          ? "No active lease found."
          : err instanceof ApiError
            ? err.message
            : "Could not load payments."}
      </div>
    );
  }

  const { lease } = leaseQuery.data!;
  const payments = paymentsQuery.data ?? [];
  const monthlyData = buildMonthlyChart(payments);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const primaryColor = cssVar("--chart-1");
  const mutedColor = cssVar("--muted-foreground");
  const borderColor = cssVar("--border");

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <CreditCard size={22} />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground">Your complete rent payment history</p>
        </div>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">Total Paid</CardDescription>
              <span className="rounded-lg bg-primary/10 p-2 text-primary"><Banknote size={14} /></span>
            </div>
            <CardTitle className="text-2xl tabular-nums font-bold">
              {formatMoney(totalPaid, lease.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All recorded payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">Payments</CardDescription>
              <span className="rounded-lg bg-primary/10 p-2 text-primary"><CheckCircle2 size={14} /></span>
            </div>
            <CardTitle className="text-2xl tabular-nums font-bold">{payments.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Transactions recorded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">Last Payment</CardDescription>
              <span className="rounded-lg bg-primary/10 p-2 text-primary"><Clock size={14} /></span>
            </div>
            <CardTitle className="text-sm font-semibold leading-snug">
              {payments.length > 0
                ? formatDateTime(payments[0].paidAt)
                : "No payments yet"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {payments.length > 0 ? formatMoney(payments[0].amount, payments[0].currency) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Monthly payments bar chart ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Monthly Payment History</CardTitle>
          <CardDescription className="text-xs mt-0.5">
            Rent payments grouped by month (last 12 months)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              No payments recorded yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={borderColor} strokeOpacity={0.35} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: mutedColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: mutedColor }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1_000
                      ? `${(v / 1_000).toFixed(0)}k`
                      : String(v)
                  }
                />
                <Tooltip content={<ChartTooltip currency={lease.currency} />} />
                <Bar dataKey="amount" name="Paid" radius={[6, 6, 0, 0]} barSize={28} maxBarSize={40}>
                  {monthlyData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={primaryColor}
                      opacity={i === monthlyData.length - 1 ? 1 : 0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Payments table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">All Transactions</CardTitle>
          <CardDescription className="text-xs">{payments.length} payment{payments.length !== 1 ? "s" : ""} recorded</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {paymentsQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/50" />)}
            </div>
          ) : paymentsQuery.isError ? (
            <p className="p-4 text-sm text-destructive">Could not load payments.</p>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <div className="rounded-full bg-muted/50 p-4">
                <CreditCard size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No payments yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-left">
                  <tr>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Method</th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {payments.map((p) => (
                    <tr key={p.id} className="group transition-colors hover:bg-muted/20">
                      <td className="px-5 py-3.5 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(p.paidAt)}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums font-semibold text-foreground">
                        {formatMoney(p.amount, p.currency)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${METHOD_COLORS[p.method] ?? "bg-muted text-muted-foreground"}`}>
                          {METHOD_LABELS[p.method] ?? p.method}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs opacity-60 group-hover:opacity-100 transition-opacity"
                          disabled={receiptMut.isPending}
                          onClick={() => receiptMut.mutate(p.id)}
                        >
                          <Download size={12} />
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
