import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError } from "@/api/client";
import { createInvitation, listInvitations, listProperties, listUnits } from "@/api/staffApi";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { fieldClass, labelClass } from "@/lib/staffUi";

export function InvitationsPage() {
  const { organization } = useAuth();
  const defaultCurrency = organization?.defaultCurrency ?? "NGN";
  const qc = useQueryClient();
  const [propertyId, setPropertyId] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const invitationsQuery = useQuery({
    queryKey: ["staff", "invitations"],
    queryFn: listInvitations,
  });

  const propertiesQuery = useQuery({
    queryKey: ["staff", "properties"],
    queryFn: listProperties,
  });

  const unitsQuery = useQuery({
    queryKey: ["staff", "units", propertyId],
    queryFn: () => listUnits(propertyId),
    enabled: Boolean(propertyId),
  });

  const createMut = useMutation({
    mutationFn: createInvitation,
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["staff", "invitations"] });
      setFormError(null);
      setInviteMessage(data.message);
    },
    onError: (e: unknown) => {
      setFormError(e instanceof ApiError ? e.message : "Could not create invitation.");
    },
  });

  const vacantUnits = unitsQuery.data?.filter((u) => u.status === "vacant") ?? [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-heading text-2xl font-bold">Invitations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pending invites to vacant units. Tenants accept via the link in their email.
        </p>
      </div>

      <div className="flex w-full justify-center lg:min-h-[min(60vh,520px)] lg:items-center lg:py-6">
        <div className="w-full max-w-xl space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-heading text-lg font-semibold">Invite tenant</h2>
        {inviteMessage ? (
          <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
            {inviteMessage}
          </p>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            const fd = new FormData(e.currentTarget);
            const email = (fd.get("email") as string).trim().toLowerCase();
            const unitId = fd.get("unitId") as string;
            const start = fd.get("startDate") as string;
            const endRaw = (fd.get("endDate") as string)?.trim();
            const billingFrequency = fd.get("billingFrequency") as "monthly" | "yearly";
            const rentRaw = (fd.get("rentAmount") as string)?.trim();
            if (!email || !unitId || !start) {
              setFormError("Email, unit, and start date are required.");
              return;
            }
            const body: Parameters<typeof createInvitation>[0] = {
              email,
              unitId,
              startDate: new Date(start).toISOString(),
              billingFrequency,
            };
            if (endRaw) body.endDate = new Date(endRaw).toISOString();
            else body.endDate = null;
            if (rentRaw) {
              const n = Number(rentRaw);
              if (!Number.isNaN(n) && n >= 0) body.rentAmount = n;
            }
            const ccy = (fd.get("currency") as string)?.trim();
            if (ccy) body.currency = ccy.toUpperCase();
            createMut.mutate(body);
          }}
        >
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div className="space-y-3">
            <div>
              <label className={labelClass} htmlFor="inv-prop">
                Property
              </label>
              <select
                id="inv-prop"
                className={fieldClass}
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  setFormError(null);
                }}
                required
              >
                <option value="">Select property</option>
                {propertiesQuery.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.addressLine1}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="inv-unit">
                Vacant unit
              </label>
              <select id="inv-unit" name="unitId" className={fieldClass} required disabled={!propertyId}>
                <option value="">{propertyId ? "Select unit" : "Choose a property first"}</option>
                {vacantUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label} — {formatMoney(u.rentAmount, u.currency)} default
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="inv-email">
                Tenant email
              </label>
              <input id="inv-email" name="email" type="email" required autoComplete="off" className={fieldClass} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="inv-start">
                  Lease start
                </label>
                <input id="inv-start" name="startDate" type="date" required className={fieldClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="inv-end">
                  Lease end (optional)
                </label>
                <input id="inv-end" name="endDate" type="date" className={fieldClass} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="inv-rent">
                  Rent override (optional)
                </label>
                <input id="inv-rent" name="rentAmount" type="number" min={0} step="0.01" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="inv-ccy">
                  Currency
                </label>
                <input
                  id="inv-ccy"
                  name="currency"
                  defaultValue={defaultCurrency}
                  maxLength={3}
                  className={fieldClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="inv-bill">
                Billing frequency
              </label>
              <select id="inv-bill" name="billingFrequency" required className={fieldClass} defaultValue="monthly">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <Button type="submit" className="mt-4" disabled={createMut.isPending || !propertyId}>
            {createMut.isPending ? "Sending…" : "Create invitation"}
          </Button>
        </form>
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold">Pending invitations</h2>
        {invitationsQuery.isLoading ? (
          <p className="mt-2 text-muted-foreground">Loading…</p>
        ) : invitationsQuery.isError ? (
          <p className="mt-2 text-destructive">
            {invitationsQuery.error instanceof ApiError
              ? invitationsQuery.error.message
              : "Could not load invitations."}
          </p>
        ) : !invitationsQuery.data?.length ? (
          <p className="mt-2 text-muted-foreground">No pending invitations.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {invitationsQuery.data.map((i) => (
              <li key={i.id} className="px-4 py-4">
                <p className="font-medium">{i.email}</p>
                <p className="text-sm text-muted-foreground">
                  {formatMoney(i.rentAmount, i.currency)} / {i.billingFrequency} · starts {formatDate(i.startDate)}
                  {i.endDate ? ` · ends ${formatDate(i.endDate)}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Expires {formatDateTime(i.expiresAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
