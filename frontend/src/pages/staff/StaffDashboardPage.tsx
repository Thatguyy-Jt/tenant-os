import { useMutation, useQuery } from "@tanstack/react-query";

import { downloadPaymentsCsv, getDashboardSummary } from "@/api/staffApi";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

export function StaffDashboardPage() {
  const { organization } = useAuth();
  const currency = organization?.defaultCurrency ?? "NGN";

  const summaryQuery = useQuery({
    queryKey: ["staff", "dashboard"],
    queryFn: getDashboardSummary,
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Portfolio snapshot and quick actions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/staff/properties">Manage properties</Link>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            {exportMutation.isPending ? "Exporting…" : "Download payments (CSV)"}
          </Button>
        </div>
      </div>

      {summaryQuery.isLoading ? (
        <p className="text-muted-foreground">Loading summary…</p>
      ) : summaryQuery.isError ? (
        <p className="text-sm text-destructive">
          {summaryQuery.error instanceof ApiError
            ? summaryQuery.error.message
            : "Could not load dashboard."}
        </p>
      ) : s ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Occupancy</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {s.occupancy.occupancyRatePercent}%
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {s.occupancy.occupiedUnits} of {s.occupancy.totalUnits} units occupied
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Revenue (period)</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatMoney(s.revenue.total, currency)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {new Date(s.revenue.from).toLocaleDateString()} —{" "}
              {new Date(s.revenue.to).toLocaleDateString()}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active leases</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{s.overdue.activeLeaseCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {s.overdue.leasesWithBalanceDue} with balance due
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Outstanding rent</CardDescription>
              <CardTitle className="text-2xl tabular-nums text-destructive">
                {formatMoney(s.overdue.totalOutstanding, currency)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Across active leases</CardContent>
          </Card>
        </div>
      ) : null}

      {exportMutation.isError ? (
        <p className="text-sm text-destructive">
          {exportMutation.error instanceof ApiError
            ? exportMutation.error.message
            : "Export failed."}
        </p>
      ) : null}
    </div>
  );
}
