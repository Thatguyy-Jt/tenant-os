import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import {
  getTenantBalance,
  getTenantLease,
  initializePaystackPayment,
  verifyPaystackPayment,
} from "@/api/tenantApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/format";

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
          setPaystackVerifyMessage("Payment recorded. Your balance and payment history are updated.");
        }
      } catch (e) {
        if (!cancelled) {
          setPaystackVerifyMessage(
            e instanceof ApiError
              ? e.message
              : "Could not confirm payment with the server. If money left your account, use Refresh or contact support."
          );
        }
      } finally {
        if (!cancelled) {
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
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paystackReturnRef, qc, setSearchParams]);

  /** Only when something is owed — after payment, balance hits 0 and Paystack UI is hidden. */
  const paystackAmountNgn = useMemo(() => {
    const bal = balanceQuery.data;
    if (!bal || bal.balance <= 0) return null;
    const n = Math.max(1, Math.round(bal.balance * 100) / 100);
    return Number.isFinite(n) ? n : null;
  }, [balanceQuery.data]);

  const paystackCurrencyOk = leaseQuery.data?.lease.currency === "NGN";

  if (leaseQuery.isLoading) {
    return <p className="text-muted-foreground">Loading your lease…</p>;
  }

  if (leaseQuery.isError) {
    const err = leaseQuery.error;
    const notFound = err instanceof ApiError && err.status === 404;
    return (
      <div className="max-w-lg space-y-2">
        <h1 className="font-heading text-2xl font-bold">Welcome</h1>
        <p className="text-muted-foreground">
          {notFound
            ? "No active lease is linked to your account yet. If you just accepted an invitation, try refreshing. Otherwise contact your landlord."
            : err instanceof ApiError
              ? err.message
              : "Could not load your lease."}
        </p>
      </div>
    );
  }

  const { lease, unit, property } = leaseQuery.data!;
  const balance = balanceQuery.data;
  const owesRent = Boolean(balance && balance.balance > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">Your rental</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {property.name || property.addressLine1} · Unit {unit.label}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Lease</CardDescription>
            <CardTitle className="text-base font-medium">
              {formatMoney(lease.rentAmount, lease.currency)} / {lease.billingFrequency}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              {formatDate(lease.startDate)}
              {lease.endDate ? ` — ${formatDate(lease.endDate)}` : " — ongoing"}
            </p>
          </CardContent>
        </Card>

        {balanceQuery.isLoading ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">Loading balance…</CardContent>
          </Card>
        ) : balance ? (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Balance due</CardDescription>
              <CardTitle
                className={`text-2xl tabular-nums ${balance.balance > 0 ? "text-destructive" : "text-foreground"}`}
              >
                {formatMoney(balance.balance, balance.currency)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Expected {formatMoney(balance.expectedTotal, balance.currency)} · Paid{" "}
              {formatMoney(balance.totalPaid, balance.currency)} (as of {formatDate(balance.asOf)})
            </CardContent>
          </Card>
        ) : null}
      </div>

      {paystackVerifyMessage ? (
        <p
          className={`rounded-md border px-3 py-2 text-sm ${
            paystackVerifyMessage.startsWith("Payment recorded")
              ? "border-border bg-muted/40 text-foreground"
              : "border-destructive/50 bg-destructive/10 text-destructive"
          }`}
        >
          {paystackVerifyMessage}
        </p>
      ) : null}

      {owesRent && !balanceQuery.isLoading ? (
        paystackCurrencyOk && paystackAmountNgn != null ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pay with Paystack</CardTitle>
              <CardDescription>
                You’ll return here after paying so we can confirm (needed if webhooks can’t reach the API).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount to pay</p>
                <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-foreground">
                  {formatMoney(paystackAmountNgn, lease.currency)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Outstanding balance through today.</p>
              </div>
              <Button
                type="button"
                disabled={payMut.isPending}
                onClick={() => payMut.mutate(paystackAmountNgn)}
              >
                {payMut.isPending ? "Redirecting…" : `Pay ${formatMoney(paystackAmountNgn, lease.currency)} on Paystack`}
              </Button>
              {payMut.isError ? (
                <p className="text-sm text-destructive">
                  {payMut.error instanceof ApiError ? payMut.error.message : "Payment setup failed."}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pay rent</CardTitle>
              <CardDescription>
                Online checkout here is for <span className="font-medium text-foreground">NGN</span> only. This lease is
                in {lease.currency}. Contact your landlord to pay your outstanding balance.
              </CardDescription>
            </CardHeader>
          </Card>
        )
      ) : null}

      {(property.photos?.length ?? 0) > 0 ? (
        <section>
          <h2 className="font-heading text-lg font-semibold">Property photos</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(property.photos ?? []).map((ph) => (
              <li key={ph.publicId} className="aspect-square overflow-hidden rounded-xl border border-border">
                <img src={ph.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-muted-foreground">
        <button
          type="button"
          className="text-primary underline-offset-4 hover:underline"
          onClick={() => void qc.invalidateQueries({ queryKey: ["tenant"] })}
        >
          Refresh data
        </button>
      </p>
    </div>
  );
}
