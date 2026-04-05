import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError } from "@/api/client";
import { getOrganization, patchOrganization } from "@/api/staffApi";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { fieldClass, labelClass } from "@/lib/staffUi";

export function OrganizationSettingsPage() {
  const { refreshSession } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["staff", "organization"],
    queryFn: getOrganization,
  });

  const mut = useMutation({
    mutationFn: patchOrganization,
    onSuccess: async () => {
      await refreshSession();
      void qc.invalidateQueries({ queryKey: ["staff", "organization"] });
      setError(null);
    },
    onError: (e: unknown) => {
      setError(e instanceof ApiError ? e.message : "Update failed.");
    },
  });

  const org = q.data;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Organization</h1>
        <p className="mt-1 text-sm text-muted-foreground">Name and default currency for new units and reporting.</p>
      </div>

      {q.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : q.isError ? (
        <p className="text-destructive">
          {q.error instanceof ApiError ? q.error.message : "Could not load organization."}
        </p>
      ) : org ? (
        <form
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            const name = (fd.get("name") as string).trim();
            const defaultCurrency = (fd.get("defaultCurrency") as string).trim().toUpperCase();
            if (!name) {
              setError("Name is required.");
              return;
            }
            if (defaultCurrency.length !== 3) {
              setError("Currency must be a 3-letter code (e.g. NGN).");
              return;
            }
            mut.mutate({ name, defaultCurrency });
          }}
        >
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div>
            <label className={labelClass} htmlFor="org-name">
              Organization name
            </label>
            <input id="org-name" name="name" required defaultValue={org.name} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="org-ccy">
              Default currency
            </label>
            <input
              id="org-ccy"
              name="defaultCurrency"
              required
              defaultValue={org.defaultCurrency}
              maxLength={3}
              className={fieldClass}
            />
          </div>
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
