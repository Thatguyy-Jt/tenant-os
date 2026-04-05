import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
import { createProperty, listProperties } from "@/api/staffApi";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { fieldClass, labelClass } from "@/lib/staffUi";
import { formatDate } from "@/lib/format";

export function PropertiesListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isLandlord = user?.role === "landlord";
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["staff", "properties"],
    queryFn: listProperties,
  });

  const createMut = useMutation({
    mutationFn: createProperty,
    onSuccess: (property) => {
      void qc.invalidateQueries({ queryKey: ["staff", "properties"] });
      setShowForm(false);
      setFormError(null);
      navigate(`/staff/properties/${property.id}`, { replace: false });
    },
    onError: (e: unknown) => {
      setFormError(e instanceof ApiError ? e.message : "Could not create property.");
    },
  });

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string)?.trim() || undefined;
    const addressLine1 = (fd.get("addressLine1") as string).trim();
    const city = (fd.get("city") as string).trim();
    const country = (fd.get("country") as string).trim();
    if (!addressLine1 || !city || !country) {
      setFormError("Address line 1, city, and country are required.");
      return;
    }
    createMut.mutate({
      name,
      addressLine1,
      addressLine2: (fd.get("addressLine2") as string)?.trim() || undefined,
      city,
      state: (fd.get("state") as string)?.trim() || undefined,
      country,
      postalCode: (fd.get("postalCode") as string)?.trim() || undefined,
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Properties</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Buildings and units in your organization.
          </p>
        </div>
        {isLandlord ? (
          <Button type="button" variant={showForm ? "secondary" : "default"} onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "Add property"}
          </Button>
        ) : null}
      </div>

      {showForm && isLandlord ? (
        <div className="flex w-full justify-center lg:min-h-[min(60vh,520px)] lg:items-center lg:py-6">
          <form
            onSubmit={(e) => void onCreate(e)}
            className="w-full max-w-xl space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
          <h2 className="font-heading text-lg font-semibold">New property</h2>
          <p className="text-sm text-muted-foreground">
            Save the address first. On the next screen you can add listing photos, units, and more.
          </p>
          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}
          <div>
            <label htmlFor="prop-name" className={labelClass}>
              Name (optional)
            </label>
            <input id="prop-name" name="name" className={fieldClass} placeholder="e.g. Main Street block" />
          </div>
          <div>
            <label htmlFor="prop-a1" className={labelClass}>
              Address line 1
            </label>
            <input id="prop-a1" name="addressLine1" required className={fieldClass} />
          </div>
          <div>
            <label htmlFor="prop-a2" className={labelClass}>
              Address line 2
            </label>
            <input id="prop-a2" name="addressLine2" className={fieldClass} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="prop-city" className={labelClass}>
                City
              </label>
              <input id="prop-city" name="city" required className={fieldClass} />
            </div>
            <div>
              <label htmlFor="prop-state" className={labelClass}>
                State / region
              </label>
              <input id="prop-state" name="state" className={fieldClass} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="prop-country" className={labelClass}>
                Country
              </label>
              <input id="prop-country" name="country" required className={fieldClass} />
            </div>
            <div>
              <label htmlFor="prop-postal" className={labelClass}>
                Postal code
              </label>
              <input id="prop-postal" name="postalCode" className={fieldClass} />
            </div>
          </div>
          <Button type="submit" disabled={createMut.isPending}>
            {createMut.isPending ? "Creating…" : "Create property"}
          </Button>
        </form>
        </div>
      ) : null}

      {q.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : q.isError ? (
        <p className="text-destructive">
          {q.error instanceof ApiError ? q.error.message : "Failed to load properties."}
        </p>
      ) : !q.data?.length ? (
        <p className="text-muted-foreground">No properties yet. Add one to get started.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {q.data.map((p) => (
            <li key={p.id}>
              <Link
                to={`/staff/properties/${p.id}`}
                className="flex flex-col gap-1 px-4 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{p.name || p.addressLine1}</p>
                  <p className="text-sm text-muted-foreground">
                    {[p.addressLine1, p.city, p.country].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">Added {formatDate(p.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
