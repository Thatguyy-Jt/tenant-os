import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { ApiError } from "@/api/client";
import { getTenantLease, listTenantDocuments, uploadTenantDocument } from "@/api/tenantApi";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { fieldClass, labelClass } from "@/lib/staffUi";

export function TenantDocumentsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const leaseQuery = useQuery({
    queryKey: ["tenant", "lease"],
    queryFn: getTenantLease,
    retry: false,
  });

  const docsQuery = useQuery({
    queryKey: ["tenant", "documents"],
    queryFn: listTenantDocuments,
    enabled: leaseQuery.isSuccess,
  });

  const uploadMut = useMutation({
    mutationFn: ({ file, label }: { file: File; label: string }) => uploadTenantDocument(file, label),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tenant", "documents"] });
    },
  });

  if (leaseQuery.isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (leaseQuery.isError) {
    const err = leaseQuery.error;
    return (
      <p className="text-destructive">
        {err instanceof ApiError && err.status === 404
          ? "No active lease — documents are tied to your lease."
          : err instanceof ApiError
            ? err.message
            : "Error."}
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8">
      <header className="w-full text-center">
        <h1 className="font-heading text-2xl font-bold">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Files shared on your lease. Uploads require Cloudinary on the server.
        </p>
      </header>

      <form
        className="w-full max-w-xl space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const label = (fd.get("label") as string).trim();
          const file = fileRef.current?.files?.[0];
          if (!file || !label) return;
          uploadMut.mutate({ file, label });
          e.currentTarget.reset();
          if (fileRef.current) fileRef.current.value = "";
        }}
      >
        <h2 className="font-heading text-lg font-semibold">Upload a file</h2>
        {uploadMut.isError ? (
          <p className="text-sm text-destructive">
            {uploadMut.error instanceof ApiError ? uploadMut.error.message : "Upload failed."}
          </p>
        ) : null}
        <div>
          <label className={labelClass} htmlFor="doc-label">
            Label
          </label>
          <input id="doc-label" name="label" required maxLength={200} className={fieldClass} placeholder="e.g. ID copy" />
        </div>
        <div>
          <label className={labelClass} htmlFor="doc-file">
            File
          </label>
          <input id="doc-file" ref={fileRef} name="file" type="file" required className={fieldClass} />
        </div>
        <Button type="submit" disabled={uploadMut.isPending}>
          {uploadMut.isPending ? "Uploading…" : "Upload"}
        </Button>
      </form>

      <div className="w-full max-w-xl">
        <h2 className="text-center font-heading text-lg font-semibold">Your documents</h2>
        {docsQuery.isLoading ? (
          <p className="mt-2 text-center text-muted-foreground">Loading…</p>
        ) : docsQuery.isError ? (
          <p className="mt-2 text-center text-destructive">Could not load documents.</p>
        ) : !docsQuery.data?.length ? (
          <p className="mt-2 text-center text-muted-foreground">No documents yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {docsQuery.data.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{d.label || d.originalFileName}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</p>
                </div>
                <a
                  href={d.cloudinaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Open
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
