import { apiFetch, apiJson, ApiError } from "@/api/client";
import type {
  LeaseBalanceDto,
  MaintenanceRequestDto,
  RentPaymentDto,
} from "@/api/staffTypes";
import type { LeaseDocumentDto, PaystackInitializeResponse, TenantLeaseResponse } from "@/api/tenantTypes";

export async function getTenantLease(): Promise<TenantLeaseResponse> {
  return apiJson<TenantLeaseResponse>("/tenant/lease");
}

export async function getTenantPayments(): Promise<RentPaymentDto[]> {
  const res = await apiJson<{ payments: RentPaymentDto[] }>("/tenant/payments");
  return res.payments;
}

export async function getTenantBalance(asOf?: string): Promise<LeaseBalanceDto> {
  const q = asOf ? `?asOf=${encodeURIComponent(asOf)}` : "";
  return apiJson<LeaseBalanceDto>(`/tenant/balance${q}`);
}

export async function listTenantMaintenanceRequests(): Promise<MaintenanceRequestDto[]> {
  const res = await apiJson<{ requests: MaintenanceRequestDto[] }>("/tenant/maintenance-requests");
  return res.requests;
}

export async function createTenantMaintenanceRequest(body: {
  title: string;
  description: string;
  priority?: "low" | "normal" | "high";
}): Promise<MaintenanceRequestDto> {
  const res = await apiJson<{ request: MaintenanceRequestDto }>("/tenant/maintenance-requests", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.request;
}

export async function listTenantDocuments(): Promise<LeaseDocumentDto[]> {
  const res = await apiJson<{ documents: LeaseDocumentDto[] }>("/tenant/documents");
  return res.documents;
}

export async function uploadTenantDocument(file: File, label: string): Promise<LeaseDocumentDto> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("label", label);
  const res = await apiFetch("/tenant/documents", { method: "POST", body: fd });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    const err = body as Record<string, unknown> | null;
    if (err && typeof err === "object") {
      const nested = err.error;
      if (
        nested &&
        typeof nested === "object" &&
        nested !== null &&
        "message" in nested &&
        typeof (nested as { message: unknown }).message === "string"
      ) {
        message = (nested as { message: string }).message;
        if ("code" in nested && typeof (nested as { code: unknown }).code === "string") {
          code = (nested as { code: string }).code;
        }
      } else if (typeof err.message === "string") {
        message = err.message;
      }
    }
    throw new ApiError(message, res.status, code);
  }
  return (body as { document: LeaseDocumentDto }).document;
}

export async function initializePaystackPayment(amountNgn: number): Promise<PaystackInitializeResponse> {
  return apiJson<PaystackInitializeResponse>("/tenant/paystack/initialize", {
    method: "POST",
    body: JSON.stringify({ amountNgn }),
  });
}

export async function downloadRentReceiptPdf(paymentId: string): Promise<Blob> {
  const res = await apiFetch(`/rent-payments/${paymentId}/receipt`);
  if (!res.ok) {
    const text = await res.text();
    let message = res.statusText;
    try {
      const j = text ? (JSON.parse(text) as { error?: { message?: string } }) : null;
      if (j?.error?.message) message = j.error.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  return res.blob();
}
