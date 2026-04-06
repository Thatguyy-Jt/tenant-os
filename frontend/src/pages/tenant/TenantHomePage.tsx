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
import { fieldClass, labelClass } from "@/lib/staffUi";

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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pay with Paystack</CardTitle>
          <CardDescription>
            Pay in NGN on Paystack, then you’ll land back here while we confirm the payment (required when your API
            URL isn’t reachable by Paystack webhooks, e.g. localhost).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex max-w-xs flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const n = Number(fd.get("amountNgn"));
              if (Number.isNaN(n) || n < 1) return;
              payMut.mutate(n);
            }}
          >
            <div className="flex-1">
              <label htmlFor="pay-amt" className={labelClass}>
                Amount (NGN)
              </label>
              <input
                id="pay-amt"
                name="amountNgn"
                type="number"
                min={1}
                step="0.01"
                required
                className={fieldClass}
                placeholder="e.g. 50000"
              />
            </div>
            <Button type="submit" disabled={payMut.isPending}>
              {payMut.isPending ? "Redirecting…" : "Continue to Paystack"}
            </Button>
          </form>
          {payMut.isError ? (
            <p className="mt-2 text-sm text-destructive">
              {payMut.error instanceof ApiError ? payMut.error.message : "Payment setup failed."}
            </p>
          ) : null}
        </CardContent>
      </Card>

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
