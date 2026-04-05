import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import {
  createUnit,
  deleteProperty,
  deletePropertyPhoto,
  deleteUnit,
  getProperty,
  listUnits,
  patchProperty,
  patchUnit,
  uploadPropertyPhoto,
} from "@/api/staffApi";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatMoney } from "@/lib/format";
import { fieldClass, labelClass } from "@/lib/staffUi";

export function PropertyDetailPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const { user, organization } = useAuth();
  const isLandlord = user?.role === "landlord";
  const defaultCurrency = organization?.defaultCurrency ?? "NGN";
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [unitFormOpen, setUnitFormOpen] = useState(false);
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const propertyQuery = useQuery({
    queryKey: ["staff", "property", propertyId],
    queryFn: () => getProperty(propertyId!),
    enabled: Boolean(propertyId),
  });

  const unitsQuery = useQuery({
    queryKey: ["staff", "units", propertyId],
    queryFn: () => listUnits(propertyId!),
    enabled: Boolean(propertyId),
  });

  const patchPropMut = useMutation({
    mutationFn: (body: Parameters<typeof patchProperty>[1]) => patchProperty(propertyId!, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", "property", propertyId] });
      void qc.invalidateQueries({ queryKey: ["staff", "properties"] });
      setEditOpen(false);
      setError(null);
    },
    onError: (e: unknown) => {
      setError(e instanceof ApiError ? e.message : "Update failed.");
    },
  });

  const deletePropMut = useMutation({
    mutationFn: () => deleteProperty(propertyId!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", "properties"] });
      navigate("/staff/properties", { replace: true });
    },
    onError: (e: unknown) => {
      setError(e instanceof ApiError ? e.message : "Delete failed.");
    },
  });

  const createUnitMut = useMutation({
    mutationFn: (body: { label: string; rentAmount: number; currency?: string }) =>
      createUnit(propertyId!, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", "units", propertyId] });
      void qc.invalidateQueries({ queryKey: ["staff", "dashboard"] });
      setUnitFormOpen(false);
      setError(null);
    },
    onError: (e: unknown) => {
      setError(e instanceof ApiError ? e.message : "Could not add unit.");
    },
  });

  const patchUnitMut = useMutation({
    mutationFn: ({
      unitId,
      body,
    }: {
      unitId: string;
      body: Parameters<typeof patchUnit>[1];
    }) => patchUnit(unitId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", "units", propertyId] });
      setEditUnitId(null);
      setError(null);
    },
    onError: (e: unknown) => {
      setError(e instanceof ApiError ? e.message : "Could not update unit.");
    },
  });

  const deleteUnitMut = useMutation({
    mutationFn: deleteUnit,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", "units", propertyId] });
      void qc.invalidateQueries({ queryKey: ["staff", "dashboard"] });
    },
    onError: (e: unknown) => {
      setError(e instanceof ApiError ? e.message : "Could not delete unit.");
    },
  });

  const photoUploadMut = useMutation({
    mutationFn: (file: File) => uploadPropertyPhoto(propertyId!, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", "property", propertyId] });
      void qc.invalidateQueries({ queryKey: ["staff", "properties"] });
      setError(null);
    },
    onError: (e: unknown) => {
      setError(e instanceof ApiError ? e.message : "Could not upload photo.");
    },
  });

  const photoDeleteMut = useMutation({
    mutationFn: (publicId: string) => deletePropertyPhoto(propertyId!, publicId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", "property", propertyId] });
      void qc.invalidateQueries({ queryKey: ["staff", "properties"] });
      setError(null);
    },
    onError: (e: unknown) => {
      setError(e instanceof ApiError ? e.message : "Could not remove photo.");
    },
  });

  if (!propertyId) {
    return <p className="text-destructive">Missing property.</p>;
  }

  const p = propertyQuery.data;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/staff/properties" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Properties
        </Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">{p?.name || p?.addressLine1 || "Property"}</h1>
            {p ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {[p.addressLine1, p.addressLine2, [p.city, p.state].filter(Boolean).join(", "), p.country]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          {isLandlord && p ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen((o) => !o)}>
                {editOpen ? "Close edit" : "Edit address"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deletePropMut.isPending}
                onClick={() => {
                  if (window.confirm("Delete this property and all its units? This cannot be undone.")) {
                    deletePropMut.mutate();
                  }
                }}
              >
                Delete property
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {propertyQuery.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : propertyQuery.isError ? (
        <p className="text-destructive">
          {propertyQuery.error instanceof ApiError ? propertyQuery.error.message : "Not found."}
        </p>
      ) : null}

      {p && !propertyQuery.isLoading ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-xl font-semibold">Photos</h2>
              <p className="text-sm text-muted-foreground">
                Listing images for this property (max 20). Requires Cloudinary on the server.
              </p>
            </div>
            {isLandlord ? (
              <>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) photoUploadMut.mutate(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    photoUploadMut.isPending ||
                    (p.photos?.length ?? 0) >= 20 ||
                    photoDeleteMut.isPending
                  }
                  onClick={() => photoInputRef.current?.click()}
                >
                  {photoUploadMut.isPending ? "Uploading…" : "Add photo"}
                </Button>
              </>
            ) : null}
          </div>
          {(p.photos?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No photos yet.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {(p.photos ?? []).map((ph) => (
                <li
                  key={ph.publicId}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
                >
                  <img src={ph.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  {isLandlord ? (
                    <div className="absolute inset-0 flex items-end justify-end bg-black/0 p-2 transition-colors group-hover:bg-black/40">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        disabled={photoDeleteMut.isPending}
                        onClick={() => {
                          if (window.confirm("Remove this photo?")) {
                            photoDeleteMut.mutate(ph.publicId);
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {editOpen && p && isLandlord ? (
        <form
          className="max-w-xl space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            patchPropMut.mutate({
              name: ((fd.get("name") as string) || "").trim() || null,
              addressLine1: (fd.get("addressLine1") as string).trim(),
              addressLine2: (fd.get("addressLine2") as string)?.trim() || null,
              city: (fd.get("city") as string).trim(),
              state: (fd.get("state") as string)?.trim() || null,
              country: (fd.get("country") as string).trim(),
              postalCode: (fd.get("postalCode") as string)?.trim() || null,
            });
          }}
        >
          <h2 className="font-heading text-lg font-semibold">Edit property</h2>
          <div>
            <label className={labelClass} htmlFor="ed-name">
              Name
            </label>
            <input
              id="ed-name"
              name="name"
              defaultValue={p.name ?? ""}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ed-a1">
              Address line 1
            </label>
            <input
              id="ed-a1"
              name="addressLine1"
              required
              defaultValue={p.addressLine1}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ed-a2">
              Address line 2
            </label>
            <input id="ed-a2" name="addressLine2" defaultValue={p.addressLine2 ?? ""} className={fieldClass} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="ed-city">
                City
              </label>
              <input id="ed-city" name="city" required defaultValue={p.city} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="ed-state">
                State
              </label>
              <input id="ed-state" name="state" defaultValue={p.state ?? ""} className={fieldClass} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="ed-country">
                Country
              </label>
              <input id="ed-country" name="country" required defaultValue={p.country} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="ed-postal">
                Postal code
              </label>
              <input id="ed-postal" name="postalCode" defaultValue={p.postalCode ?? ""} className={fieldClass} />
            </div>
          </div>
          <Button type="submit" disabled={patchPropMut.isPending}>
            {patchPropMut.isPending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-heading text-xl font-semibold">Units</h2>
        {isLandlord ? (
          <Button type="button" variant={unitFormOpen ? "secondary" : "default"} size="sm" onClick={() => setUnitFormOpen((v) => !v)}>
            {unitFormOpen ? "Cancel" : "Add unit"}
          </Button>
        ) : null}
      </div>

      {unitFormOpen && isLandlord ? (
        <form
          className="max-w-md space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const label = (fd.get("label") as string).trim();
            const rent = Number(fd.get("rentAmount"));
            if (!label || Number.isNaN(rent) || rent < 0) {
              setError("Enter a label and valid rent amount.");
              return;
            }
            createUnitMut.mutate({
              label,
              rentAmount: rent,
              currency: (fd.get("currency") as string)?.trim() || defaultCurrency,
            });
          }}
        >
          <div>
            <label className={labelClass} htmlFor="u-label">
              Unit label
            </label>
            <input id="u-label" name="label" required className={fieldClass} placeholder="e.g. 2B" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="u-rent">
                Rent amount
              </label>
              <input id="u-rent" name="rentAmount" type="number" min={0} step="0.01" required className={fieldClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="u-ccy">
                Currency
              </label>
              <input
                id="u-ccy"
                name="currency"
                defaultValue={defaultCurrency}
                maxLength={3}
                className={fieldClass}
              />
            </div>
          </div>
          <Button type="submit" disabled={createUnitMut.isPending}>
            {createUnitMut.isPending ? "Adding…" : "Add unit"}
          </Button>
        </form>
      ) : null}

      {unitsQuery.isLoading ? (
        <p className="text-muted-foreground">Loading units…</p>
      ) : unitsQuery.isError ? (
        <p className="text-destructive">Could not load units.</p>
      ) : !unitsQuery.data?.length ? (
        <p className="text-muted-foreground">No units yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium">Rent</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {unitsQuery.data.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium">{u.label}</td>
                  <td className="px-4 py-3 tabular-nums">{formatMoney(u.rentAmount, u.currency)}</td>
                  <td className="px-4 py-3 capitalize">{u.status}</td>
                  <td className="px-4 py-3 text-right">
                    {isLandlord ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditUnitId((id) => (id === u.id ? null : u.id))}
                        >
                          {editUnitId === u.id ? "Close" : "Edit"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={deleteUnitMut.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete unit ${u.label}?`)) {
                              deleteUnitMut.mutate(u.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editUnitId && unitsQuery.data
        ? (() => {
            const u = unitsQuery.data.find((x) => x.id === editUnitId);
            if (!u) return null;
            return (
              <form
                className="max-w-md space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const label = (fd.get("label") as string).trim();
                  const rent = Number(fd.get("rentAmount"));
                  patchUnitMut.mutate({
                    unitId: u.id,
                    body: {
                      label,
                      rentAmount: rent,
                      currency: (fd.get("currency") as string)?.trim() || u.currency,
                      status: fd.get("status") as "vacant" | "occupied",
                    },
                  });
                }}
              >
                <h3 className="font-heading text-lg font-semibold">Edit unit {u.label}</h3>
                <div>
                  <label className={labelClass} htmlFor="eu-label">
                    Label
                  </label>
                  <input id="eu-label" name="label" required defaultValue={u.label} className={fieldClass} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="eu-rent">
                      Rent
                    </label>
                    <input
                      id="eu-rent"
                      name="rentAmount"
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      defaultValue={u.rentAmount}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="eu-ccy">
                      Currency
                    </label>
                    <input id="eu-ccy" name="currency" defaultValue={u.currency} maxLength={3} className={fieldClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="eu-status">
                    Status
                  </label>
                  <select id="eu-status" name="status" defaultValue={u.status} className={fieldClass}>
                    <option value="vacant">vacant</option>
                    <option value="occupied">occupied</option>
                  </select>
                </div>
                <Button type="submit" disabled={patchUnitMut.isPending}>
                  {patchUnitMut.isPending ? "Saving…" : "Save unit"}
                </Button>
              </form>
            );
          })()
        : null}

      {p ? (
        <p className="text-xs text-muted-foreground">Last updated {formatDate(p.updatedAt)}</p>
      ) : null}
    </div>
  );
}
