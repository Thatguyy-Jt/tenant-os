import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  Home,
  CalendarDays,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Building2,
  ArrowRight,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { ApiError } from "@/api/client";
import {
  getTenantBalance,
  getTenantLease,
  getTenantPayments,
  initializePaystackPayment,
  verifyPaystackPayment,
} from "@/api/tenantApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/format";
import type { RentPaymentDto } from "@/api/staffTypes";
import type { LeaseDto } from "@/api/staffTypes";

// ── helpers ────────────────────────────────────────────────────
function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  const day = out.getDate();
  out.setMonth(out.getMonth() + n);
  if (out.getDate() < day) out.setDate(0);
  return out;
}
function addYears(d: Date, n: number): Date {
  const out = new Date(d);
  out.setFullYear(out.getFullYear() + n);
  return out;
}

type PeriodSlot = {
  label: string;
  dueDate: Date;
  expected: number;
  paid: number;
  status: "paid" | "partial" | "overdue" | "upcoming";
};

function buildPaymentTimeline(lease: LeaseDto, payments: RentPaymentDto[]): PeriodSlot[] {
  const start = new Date(lease.startDate);
  const end = lease.endDate ? new Date(lease.endDate) : null;
  const now = new Date();
  const freq = lease.billingFrequency as "monthly" | "yearly";
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Collect all period due-dates from start up to now + 3 future
  const slots: PeriodSlot[] = [];
  let cursor = new Date(start);

  while (true) {
    if (end && cursor > end) break;
    const periodEnd = freq === "yearly" ? addYears(cursor, 1) : addMonths(cursor, 1);
    const label =
      freq === "yearly"
        ? `${cursor.getFullYear()}`
        : `${monthNames[cursor.getMonth()]} '${String(cursor.getFullYear()).slice(2)}`;

    const isPast = cursor <= now;
    const paidInPeriod = payments
      .filter((p) => {
        const pd = new Date(p.paidAt);
        return pd >= cursor && pd < periodEnd;
      })
      .reduce((sum, p) => sum + p.amount, 0);

    let status: PeriodSlot["status"];
    if (!isPast) {
      status = "upcoming";
    } else if (paidInPeriod >= lease.rentAmount - 0.01) {
      status = "paid";
    } else if (paidInPeriod > 0) {
      status = "partial";
    } else {
      status = "overdue";
    }

    slots.push({
      label,
      dueDate: new Date(cursor),
      expected: lease.rentAmount,
      paid: Math.round(paidInPeriod * 100) / 100,
      status,
    });

    cursor = periodEnd;

    // Only show last 6 past periods + up to 3 future periods
    const futureCount = slots.filter((s) => s.status === "upcoming").length;
    if (futureCount >= 3 && !isPast) break;
    // Stop if we've gone more than 3 years into the future (safety)
    if (cursor.getTime() - now.getTime() > 3 * 365 * 24 * 3600_000) break;
  }

  // Trim to last 6 past + next 3 upcoming
  const past = slots.filter((s) => s.status !== "upcoming");
  const upcoming = slots.filter((s) => s.status === "upcoming").slice(0, 3);
  const pastSlice = past.slice(-6);
  return [...pastSlice, ...upcoming];
}

function nextDueDate(lease: LeaseDto): Date | null {
  const start = new Date(lease.startDate);
  const now = new Date();
  const freq = lease.billingFrequency as "monthly" | "yearly";
  let cursor = new Date(start);
  while (cursor <= now) {
    cursor = freq === "yearly" ? addYears(cursor, 1) : addMonths(cursor, 1);
  }
  return cursor;
}

function daysUntil(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function cssVar(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return "#22d3ee";
  if (/^\d/.test(raw)) return `hsl(${raw})`;
  return raw;
}

// ── custom tooltip ──────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PayTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-popover px-4 py-3 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-foreground text-sm">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill ?? p.color }}>
          {p.name}: {formatMoney(p.value as number, currency)}
        </p>
      ))}
    </div>
  );
}

// ── main component ──────────────────────────────────────────────
export function TenantHomePage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [paystackVerifyMessage, setPaystackVerifyMessage] = useState<string | null>(null);

  const paystackReturnRef = useMemo(
    () => searchParams.get("reference") ?? searchParams.get("trxref"),
    [searchParams]
  );

  const leaseQuery = useQuery({
    queryKey: ["tenant", "lease"],
    queryFn: getTenantLease,
    retry: false,
  });

  const balanceQuery = useQuery({
    queryKey: ["tenant", "balance"],
    queryFn: () => getTenantBalance(),
    enabled: leaseQuery.isSuccess,
  });

  const paymentsQuery = useQuery({
    queryKey: ["tenant", "payments"],
    queryFn: getTenantPayments,
    enabled: leaseQuery.isSuccess,
  });

  const payMut = useMutation({
    mutationFn: (amountNgn: number) => initializePaystackPayment(amountNgn),
    onSuccess: (data) => {
      window.location.href = data.authorizationUrl;
    },
  });

  useEffect(() => {
    if (!paystackReturnRef) return;
    let cancelled = false;
    setPaystackVerifyMessage(null);
    void (async () => {
      try {
        await verifyPaystackPayment(paystackReturnRef);
        if (!cancelled) {
          await qc.invalidateQueries({ queryKey: ["tenant"] });
          await qc.refetchQueries({ queryKey: ["tenant"] });
          setPaystackVerifyMessage("Payment recorded. Your balance and payment history are updated.");
        }
      } catch (e) {
        if (!cancelled)
          setPaystackVerifyMessage(
            e instanceof ApiError
              ? e.message
              : "Could not confirm payment. If money left your account, contact support."
          );
      } finally {
        if (!cancelled)
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete("reference");
              next.delete("trxref");
              return next;
            },
            { replace: true }
          );
      }
    })();
    return () => { cancelled = true; };
  }, [paystackReturnRef, qc, setSearchParams]);

  const roundedBalance = useMemo(() => {
    const b = balanceQuery.data?.balance;
    if (b == null || !Number.isFinite(b)) return null;
    return Math.round(b * 100) / 100;
  }, [balanceQuery.data?.balance]);

  const paystackAmountNgn = useMemo(() => {
    if (roundedBalance == null || roundedBalance < 1) return null;
    return Math.max(1, roundedBalance);
  }, [roundedBalance]);

  // ── loading / error states ────────────────────────────────────
  if (leaseQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl bg-muted/50" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/50" />)}
        </div>
      </div>
    );
  }

  if (leaseQuery.isError) {
    const err = leaseQuery.error;
    const notFound = err instanceof ApiError && err.status === 404;
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-full bg-muted/50 p-5">
          <Home size={32} className="text-muted-foreground" />
        </div>
        <h1 className="font-heading text-2xl font-bold">Welcome to TenantOS</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {notFound
            ? "No active lease is linked to your account yet. If you accepted an invitation, try refreshing. Otherwise contact your landlord."
            : err instanceof ApiError
              ? err.message
              : "Could not load your lease."}
        </p>
        <Button
          variant="outline"
          className="mt-6 gap-2"
          onClick={() => void qc.invalidateQueries({ queryKey: ["tenant"] })}
        >
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>
    );
  }

  const { lease, unit, property } = leaseQuery.data!;
  const balance = balanceQuery.data;
  const payments = paymentsQuery.data ?? [];
  const paystackCurrencyOk = lease.currency === "NGN";
  const owesRent = roundedBalance != null && roundedBalance > 0 && (paystackCurrencyOk ? roundedBalance >= 1 : true);

  const timeline = buildPaymentTimeline(lease, payments);
  const nextDue = nextDueDate(lease);
  const daysLeft = nextDue ? daysUntil(nextDue) : null;

  const primary = cssVar("--chart-1");
  const secondary = cssVar("--chart-2");
  const muted = cssVar("--muted-foreground");
  const borderColor = cssVar("--border");

  const barColors: Record<PeriodSlot["status"], string> = {
    paid: primary,
    partial: cssVar("--chart-4"),
    overdue: "hsl(0 84% 60%)",
    upcoming: cssVar("--chart-3"),
  };

  // Lease progress %
  const leaseStart = new Date(lease.startDate).getTime();
  const leaseEnd = lease.endDate ? new Date(lease.endDate).getTime() : null;
  const leaseProgress =
    leaseEnd != null
      ? Math.min(100, Math.max(0, Math.round(((Date.now() - leaseStart) / (leaseEnd - leaseStart)) * 100)))
      : null;

  return (
    <div className="space-y-8">
      {/* ── Property hero banner ── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <Building2 size={15} className="text-primary" />
              <span className="text-xs font-medium text-primary">Your Rental</span>
            </div>
            <h1 className="font-heading text-2xl font-bold">
              {property.name || property.addressLine1}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Unit {unit.label} · {property.city}{property.state ? `, ${property.state}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {property.addressLine1}{property.addressLine2 ? `, ${property.addressLine2}` : ""}
            </p>
          </div>
          {(property.photos?.length ?? 0) > 0 ? (
            <div className="hidden sm:flex gap-2">
              {(property.photos ?? []).slice(0, 2).map((ph) => (
                <img
                  key={ph.publicId}
                  src={ph.url}
                  alt=""
                  className="h-20 w-28 rounded-xl object-cover border border-border/60"
                  loading="lazy"
                />
              ))}
            </div>
          ) : (
            <div className="hidden sm:flex h-20 w-28 items-center justify-center rounded-xl border border-border/40 bg-muted/40">
              <Building2 size={28} className="text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Lease progress bar */}
        {leaseProgress != null && leaseEnd != null && (
          <div className="mt-5 border-t border-border/40 pt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Lease term</span>
              <span className="font-medium text-foreground">{leaseProgress}% complete</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${leaseProgress}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{formatDate(lease.startDate)}</span>
              <span>{formatDate(lease.endDate!)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Paystack return notification ── */}
      {paystackVerifyMessage && (
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            paystackVerifyMessage.startsWith("Payment recorded")
              ? "border-primary/30 bg-primary/8 text-foreground"
              : "border-destructive/40 bg-destructive/8 text-destructive"
          }`}
        >
          {paystackVerifyMessage.startsWith("Payment recorded")
            ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
            : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          {paystackVerifyMessage}
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Balance due */}
        <Card className={roundedBalance != null && roundedBalance > 0 ? "border-destructive/40 bg-destructive/5" : ""}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">Balance Due</CardDescription>
              <span className={`rounded-lg p-2 ${roundedBalance != null && roundedBalance > 0 ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"}`}>
                <Wallet size={14} />
              </span>
            </div>
            <CardTitle className={`text-2xl tabular-nums font-bold ${roundedBalance != null && roundedBalance > 0 ? "text-destructive" : "text-foreground"}`}>
              {balanceQuery.isLoading
                ? "—"
                : balance
                  ? formatMoney(balance.balance, balance.currency)
                  : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {roundedBalance != null && roundedBalance <= 0 ? "All caught up! No balance due." : "Outstanding as of today"}
            </p>
          </CardContent>
        </Card>

        {/* Monthly rent */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">Rent</CardDescription>
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <CreditCard size={14} />
              </span>
            </div>
            <CardTitle className="text-2xl tabular-nums font-bold">
              {formatMoney(lease.rentAmount, lease.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground capitalize">Per {lease.billingFrequency}</p>
          </CardContent>
        </Card>

        {/* Next due date */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">Next Due</CardDescription>
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <CalendarDays size={14} />
              </span>
            </div>
            <CardTitle className="text-2xl tabular-nums font-bold">
              {nextDue ? formatDate(nextDue.toISOString()) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xs font-medium ${daysLeft != null && daysLeft <= 7 ? "text-destructive" : "text-muted-foreground"}`}>
              {daysLeft != null ? (daysLeft === 0 ? "Due today!" : daysLeft === 1 ? "Due tomorrow" : `In ${daysLeft} days`) : "—"}
            </p>
          </CardContent>
        </Card>

        {/* Paid total */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">Total Paid</CardDescription>
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <CheckCircle2 size={14} />
              </span>
            </div>
            <CardTitle className="text-2xl tabular-nums font-bold">
              {balance ? formatMoney(balance.totalPaid, balance.currency) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All recorded payments</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Payment Timeline Chart ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Payment Timeline</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Past payments vs expected rent — grey bars show upcoming periods
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {(["paid", "partial", "overdue", "upcoming"] as const).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: barColors[s] }} />
                  <span className="capitalize">{s}</span>
                </span>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              No payment data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={timeline} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={borderColor} strokeOpacity={0.35} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: muted }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: muted }}
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
                <Tooltip content={<PayTooltip currency={lease.currency} />} />
                <ReferenceLine y={lease.rentAmount} stroke={primary} strokeDasharray="4 3" strokeOpacity={0.5} />
                <Bar dataKey="expected" name="Expected" fill={cssVar("--muted")} radius={[4, 4, 0, 0]} barSize={18} opacity={0.4} />
                <Bar dataKey="paid" name="Paid" radius={[4, 4, 0, 0]} barSize={18}>
                  {timeline.map((entry) => (
                    <Cell key={entry.label} fill={barColors[entry.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Pay rent section ── */}
      {owesRent && !balanceQuery.isLoading ? (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/15 p-3 text-primary">
                <CreditCard size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">Pay Rent</CardTitle>
                <CardDescription className="text-sm">
                  {paystackCurrencyOk
                    ? "Online checkout via Paystack. You'll return here after paying."
                    : `Online checkout is NGN only. This lease is in ${lease.currency}. Contact your landlord.`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          {paystackCurrencyOk && paystackAmountNgn != null && (
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-5 py-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount to pay</p>
                  <p className="mt-1 font-heading text-3xl font-bold tabular-nums text-foreground">
                    {formatMoney(paystackAmountNgn, lease.currency)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Outstanding balance through today</p>
                </div>
                <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Wallet size={24} />
                </div>
              </div>
              <Button
                size="lg"
                className="w-full gap-2"
                disabled={payMut.isPending}
                onClick={() => payMut.mutate(paystackAmountNgn)}
              >
                {payMut.isPending ? "Redirecting to Paystack…" : (
                  <>Pay {formatMoney(paystackAmountNgn, lease.currency)} via Paystack <ArrowRight size={16} /></>
                )}
              </Button>
              {payMut.isError && (
                <p className="text-sm text-destructive">
                  {payMut.error instanceof ApiError ? payMut.error.message : "Payment setup failed."}
                </p>
              )}
            </CardContent>
          )}
        </Card>
      ) : roundedBalance != null && roundedBalance <= 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/8 px-5 py-4 text-sm">
          <CheckCircle2 size={20} className="shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-foreground">You're all caught up!</p>
            <p className="text-xs text-muted-foreground">No outstanding balance. Next rent due {nextDue ? formatDate(nextDue.toISOString()) : "—"}.</p>
          </div>
        </div>
      ) : null}

      {/* ── Property photos ── */}
      {(property.photos?.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-base font-semibold">Property Photos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(property.photos ?? []).map((ph) => (
              <div key={ph.publicId} className="aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted/30">
                <img src={ph.url} alt="" className="h-full w-full object-cover transition-transform hover:scale-105" loading="lazy" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Quick links ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { to: "/tenant/payments", icon: CreditCard, label: "View all payments", desc: "Full payment history & receipts" },
          { to: "/tenant/maintenance", icon: "wrench", label: "Maintenance", desc: "Report an issue with your unit" },
          { to: "/tenant/documents", icon: "file", label: "Documents", desc: "Lease documents & uploads" },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3.5 text-sm transition-all hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <ArrowRight size={14} />
            </span>
            <div>
              <p className="font-medium text-foreground group-hover:text-primary transition-colors">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <ArrowRight size={13} className="ml-auto text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
          </Link>
        ))}
      </div>

      {/* ── Refresh ── */}
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        onClick={() => void qc.invalidateQueries({ queryKey: ["tenant"] })}
      >
        <RefreshCw size={12} />
        Refresh data
      </button>
    </div>
  );
}
