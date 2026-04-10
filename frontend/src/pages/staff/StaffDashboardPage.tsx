import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Building2,
  Users,
  AlertCircle,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  LayoutDashboard,
} from "lucide-react";

import { downloadPaymentsCsv, getDashboardCharts, getDashboardSummary } from "@/api/staffApi";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

// Resolve CSS variable to usable color string for recharts
function cssVar(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return "#22d3ee";
  // If it's an HSL value like "174 72% 46%", wrap it
  if (/^\d/.test(raw)) return `hsl(${raw})`;
  return raw;
}

function useChartColors() {
  return {
    primary: cssVar("--chart-1"),
    secondary: cssVar("--chart-2"),
    tertiary: cssVar("--chart-3"),
    quaternary: cssVar("--chart-4"),
    quinary: cssVar("--chart-5"),
    muted: cssVar("--muted-foreground"),
    border: cssVar("--border"),
  };
}

type StatCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  highlight?: boolean;
};

function StatCard({ title, value, subtitle, icon, trend, trendLabel, highlight }: StatCardProps) {
  return (
    <Card className={`relative overflow-hidden transition-shadow hover:shadow-lg ${highlight ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardDescription className="text-xs font-medium uppercase tracking-wider">
            {title}
          </CardDescription>
          <span className={`rounded-lg p-2 ${highlight ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"}`}>
            {icon}
          </span>
        </div>
        <CardTitle className={`mt-1 text-2xl font-bold tabular-nums ${highlight ? "text-destructive" : ""}`}>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        {trendLabel && (
          <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${trend === "up" ? "text-emerald-500" : trend === "down" ? "text-destructive" : "text-muted-foreground"}`}>
            {trend === "up" ? <ArrowUpRight size={12} /> : trend === "down" ? <ArrowDownRight size={12} /> : null}
            {trendLabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 shadow-xl text-xs">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" && currency ? formatMoney(p.value, currency) : p.value}
        </p>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 shadow-xl text-xs">
      <p className="font-medium text-foreground">{payload[0].name}</p>
      <p style={{ color: payload[0].payload.fill }}>{payload[0].value} units</p>
    </div>
  );
}

export function StaffDashboardPage() {
  const { organization } = useAuth();
  const currency = organization?.defaultCurrency ?? "NGN";
  const colors = useChartColors();

  const summaryQuery = useQuery({
    queryKey: ["staff", "dashboard"],
    queryFn: getDashboardSummary,
  });

  const chartsQuery = useQuery({
    queryKey: ["staff", "dashboard-charts"],
    queryFn: getDashboardCharts,
  });

  const exportMutation = useMutation({
    mutationFn: () => downloadPaymentsCsv(),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tenantos-payments.csv";
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const s = summaryQuery.data;
  const c = chartsQuery.data;

  const isLoading = summaryQuery.isLoading || chartsQuery.isLoading;
  const isError = summaryQuery.isError || chartsQuery.isError;

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Your portfolio at a glance.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/staff/properties">
              <Building2 size={14} className="mr-1.5" />
              Manage properties
            </Link>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            <Download size={14} className="mr-1.5" />
            {exportMutation.isPending ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="mt-2 h-8 w-32 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-3 w-40 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {summaryQuery.error instanceof ApiError
            ? summaryQuery.error.message
            : "Could not load dashboard."}
        </p>
      ) : s && c ? (
        <>
          {/* ── KPI cards ── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Occupancy Rate"
              value={`${s.occupancy.occupancyRatePercent}%`}
              subtitle={`${s.occupancy.occupiedUnits} of ${s.occupancy.totalUnits} units occupied`}
              icon={<Building2 size={16} />}
              trend={s.occupancy.occupancyRatePercent >= 75 ? "up" : "down"}
              trendLabel={s.occupancy.occupancyRatePercent >= 75 ? "Healthy occupancy" : "Below 75% target"}
            />
            <StatCard
              title="Revenue (30 days)"
              value={formatMoney(s.revenue.total, currency)}
              subtitle={`${new Date(s.revenue.from).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — ${new Date(s.revenue.to).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
              icon={<TrendingUp size={16} />}
              trend="neutral"
              trendLabel="Recorded payments in window"
            />
            <StatCard
              title="Active Leases"
              value={String(s.overdue.activeLeaseCount)}
              subtitle={`${s.overdue.leasesWithBalanceDue} with outstanding balance`}
              icon={<Users size={16} />}
              trend={s.overdue.leasesWithBalanceDue === 0 ? "up" : "neutral"}
              trendLabel={s.overdue.leasesWithBalanceDue === 0 ? "All tenants paid up" : `${s.overdue.leasesWithBalanceDue} need follow-up`}
            />
            <StatCard
              title="Outstanding Rent"
              value={formatMoney(s.overdue.totalOutstanding, currency)}
              subtitle="Accrued to today minus all recorded payments"
              icon={<AlertCircle size={16} />}
              trend={s.overdue.totalOutstanding === 0 ? "up" : "down"}
              trendLabel={s.overdue.totalOutstanding === 0 ? "Fully collected" : "Unpaid balance across leases"}
              highlight={s.overdue.totalOutstanding > 0}
            />
          </div>

          {/* ── Revenue Area Chart ── */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Monthly Revenue</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Recorded rent payments over the last 6 months
                    </CardDescription>
                  </div>
                  <TrendingUp size={18} className="text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                {c.monthlyRevenue.every((m) => m.revenue === 0) ? (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                    No payment data yet for this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={c.monthlyRevenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colors.primary} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${colors.border}`} strokeOpacity={0.4} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: colors.muted }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: colors.muted }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}M`
                            : v >= 1_000
                            ? `${(v / 1_000).toFixed(0)}k`
                            : String(v)
                        }
                        width={48}
                      />
                      <Tooltip content={<CustomTooltip currency={currency} />} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke={colors.primary}
                        strokeWidth={2.5}
                        fill="url(#revenueGrad)"
                        dot={{ fill: colors.primary, r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* ── Occupancy Pie ── */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Occupancy</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Occupied vs vacant units
                    </CardDescription>
                  </div>
                  <Building2 size={18} className="text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                {s.occupancy.totalUnits === 0 ? (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                    No units yet.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={c.occupancyBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={78}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {c.occupancyBreakdown.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={index === 0 ? colors.primary : colors.tertiary}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex justify-center gap-6 text-xs">
                      {c.occupancyBreakdown.map((entry, index) => (
                        <div key={entry.name} className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: index === 0 ? colors.primary : colors.tertiary }}
                          />
                          <span className="text-muted-foreground">{entry.name}</span>
                          <span className="font-semibold text-foreground">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Rent Collection + Lease Health ── */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Rent collection bar */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Rent Collection</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Total accrued rent vs amount collected across active leases
                    </CardDescription>
                  </div>
                  <AlertCircle size={18} className="text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                {c.rentCollectionSummary.totalAccrued === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    No active lease data.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart
                        data={[
                          {
                            label: "Rent",
                            Accrued: c.rentCollectionSummary.totalAccrued,
                            Collected: c.rentCollectionSummary.totalPaid,
                            Outstanding: c.rentCollectionSummary.totalOutstanding,
                          },
                        ]}
                        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.4} horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10, fill: colors.muted }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) =>
                            v >= 1_000_000
                              ? `${(v / 1_000_000).toFixed(1)}M`
                              : v >= 1_000
                              ? `${(v / 1_000).toFixed(0)}k`
                              : String(v)
                          }
                        />
                        <YAxis type="category" dataKey="label" hide />
                        <Tooltip content={<CustomTooltip currency={currency} />} />
                        <Legend
                          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                          iconType="circle"
                          iconSize={8}
                        />
                        <Bar dataKey="Accrued" fill={colors.quaternary} radius={[0, 4, 4, 0]} barSize={20} />
                        <Bar dataKey="Collected" fill={colors.primary} radius={[0, 4, 4, 0]} barSize={20} />
                        <Bar dataKey="Outstanding" fill={colors.tertiary} radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-center text-xs">
                      <div>
                        <p className="text-muted-foreground">Accrued</p>
                        <p className="mt-0.5 font-semibold text-foreground tabular-nums">
                          {formatMoney(c.rentCollectionSummary.totalAccrued, currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Collected</p>
                        <p className="mt-0.5 font-semibold text-primary tabular-nums">
                          {formatMoney(c.rentCollectionSummary.totalPaid, currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Outstanding</p>
                        <p className={`mt-0.5 font-semibold tabular-nums ${c.rentCollectionSummary.totalOutstanding > 0 ? "text-destructive" : "text-emerald-500"}`}>
                          {formatMoney(c.rentCollectionSummary.totalOutstanding, currency)}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Lease Health Bar */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Lease Health</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Active leases — paid up vs balance due
                    </CardDescription>
                  </div>
                  <Users size={18} className="text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                {s.overdue.activeLeaseCount === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    No active leases yet.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart
                        data={c.leaseHealth}
                        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.4} vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: colors.muted }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: colors.muted }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                          width={28}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" name="Leases" radius={[6, 6, 0, 0]} barSize={60}>
                          {c.leaseHealth.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={index === 0 ? colors.primary : colors.secondary}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex justify-center gap-8 text-xs">
                      {c.leaseHealth.map((entry, index) => (
                        <div key={entry.name} className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: index === 0 ? colors.primary : colors.secondary }}
                          />
                          <span className="text-muted-foreground">{entry.name}</span>
                          <span className="font-bold text-foreground">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {exportMutation.isError ? (
        <p className="text-sm text-destructive">
          {exportMutation.error instanceof ApiError ? exportMutation.error.message : "Export failed."}
        </p>
      ) : null}
    </div>
  );
}
