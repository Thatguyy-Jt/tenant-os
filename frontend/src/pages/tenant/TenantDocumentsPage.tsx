import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  ExternalLink,
  AlertTriangle,
  Plus,
  File,
  FileImage,
  FileArchive,
} from "lucide-react";

import { ApiError } from "@/api/client";
import { getTenantLease, listTenantDocuments, uploadTenantDocument } from "@/api/tenantApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { fieldClass, labelClass } from "@/lib/staffUi";

function fileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext ?? ""))
    return <FileImage size={20} className="text-primary" />;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext ?? ""))
    return <FileArchive size={20} className="text-amber-500" />;
  return <File size={20} className="text-muted-foreground" />;
}

function formatFileExt(fileName: string) {
  return fileName.split(".").pop()?.toUpperCase() ?? "FILE";
}

export function TenantDocumentsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
      setShowForm(false);
      setSelectedFile(null);
    },
  });

  if (leaseQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-muted/50" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/50" />)}
        </div>
      </div>
    );
  }

  if (leaseQuery.isError) {
    const err = leaseQuery.error;
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
        {err instanceof ApiError && err.status === 404
          ? "No active lease — documents are tied to your lease."
          : err instanceof ApiError ? err.message : "Error."}
      </div>
    );
  }

  const docs = docsQuery.data ?? [];

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <FileText size={22} />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Documents</h1>
            <p className="text-sm text-muted-foreground">Lease documents and file uploads</p>
          </div>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="gap-2 self-start sm:self-auto">
          <Plus size={15} />
          {showForm ? "Cancel" : "Upload File"}
        </Button>
      </div>

      {/* ── Upload form ── */}
      {showForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Upload a Document</CardTitle>
            <CardDescription className="text-xs">
              Files are stored securely via Cloudinary. Requires Cloudinary to be configured on the server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const label = (fd.get("label") as string).trim();
                const file = fileRef.current?.files?.[0] ?? selectedFile;
                if (!file || !label) return;
                uploadMut.mutate({ file, label });
              }}
            >
              {uploadMut.isError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle size={14} className="shrink-0" />
                  {uploadMut.error instanceof ApiError ? uploadMut.error.message : "Upload failed."}
                </div>
              )}
              <div>
                <label className={labelClass} htmlFor="doc-label">Label</label>
                <input
                  id="doc-label"
                  name="label"
                  required
                  maxLength={200}
                  className={fieldClass}
                  placeholder="e.g. Government ID, Lease agreement"
                />
              </div>

              {/* Drag-and-drop upload area */}
              <div>
                <label className={labelClass}>File</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) setSelectedFile(file);
                  }}
                  className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors cursor-pointer ${
                    dragOver
                      ? "border-primary bg-primary/8"
                      : "border-border/60 hover:border-primary/50 hover:bg-primary/5"
                  }`}
                  onClick={() => fileRef.current?.click()}
                >
                  <input
                    id="doc-file"
                    ref={fileRef}
                    name="file"
                    type="file"
                    required={!selectedFile}
                    className="sr-only"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                  {selectedFile ? (
                    <div className="flex items-center gap-3">
                      {fileIcon(selectedFile.name)}
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} className="mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Drop a file here</p>
                      <p className="text-xs text-muted-foreground">or click to browse</p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={uploadMut.isPending} className="gap-2">
                  <Upload size={14} />
                  {uploadMut.isPending ? "Uploading…" : "Upload File"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setSelectedFile(null); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Documents grid ── */}
      {docsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/50" />)}
        </div>
      ) : docsQuery.isError ? (
        <p className="text-sm text-destructive">Could not load documents.</p>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 py-20 text-center">
          <div className="rounded-full bg-muted/50 p-5">
            <FileText size={28} className="text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-muted-foreground">No documents yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Upload your first document using the button above</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold">
              {docs.length} document{docs.length !== 1 ? "s" : ""}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((d) => (
              <Card key={d.id} className="group transition-all hover:border-primary/40 hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/50">
                      {fileIcon(d.originalFileName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground leading-tight">
                        {d.label || d.originalFileName}
                      </p>
                      {d.label && d.label !== d.originalFileName && (
                        <p className="truncate text-xs text-muted-foreground mt-0.5">{d.originalFileName}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
                          {formatFileExt(d.originalFileName)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(d.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <a
                      href={d.cloudinaryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
                    >
                      <ExternalLink size={12} />
                      Open
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
