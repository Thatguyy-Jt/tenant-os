import { apiFetch, apiJson, ApiError } from "@/api/client";
import type {
  DashboardSummary,
  InvitationDto,
  LeaseBalanceDto,
  LeaseDto,
  MaintenanceRequestDto,
  NotificationDto,
  OrganizationDto,
  PropertyDto,
  RentPaymentDto,
  UnitDto,
} from "@/api/staffTypes";

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return apiJson<DashboardSummary>("/dashboard/summary");
}

export async function listProperties(): Promise<PropertyDto[]> {
  const res = await apiJson<{ properties: PropertyDto[] }>("/properties");
  return res.properties;
}

export async function createProperty(body: {
  name?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
}): Promise<PropertyDto> {
  const res = await apiJson<{ property: PropertyDto }>("/properties", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.property;
}

export async function getProperty(propertyId: string): Promise<PropertyDto> {
  const res = await apiJson<{ property: PropertyDto }>(`/properties/${propertyId}`);
  return res.property;
}

export async function patchProperty(
  propertyId: string,
  body: Partial<{
    name: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string | null;
    country: string;
    postalCode: string | null;
  }>
): Promise<PropertyDto> {
  const res = await apiJson<{ property: PropertyDto }>(`/properties/${propertyId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.property;
}

export async function deleteProperty(propertyId: string): Promise<void> {
  const res = await apiFetch(`/properties/${propertyId}`, { method: "DELETE" });
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
}

export async function uploadPropertyPhoto(propertyId: string, file: File): Promise<PropertyDto> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await apiFetch(`/properties/${propertyId}/photos`, { method: "POST", body: fd });
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
  return (body as { property: PropertyDto }).property;
}

export async function deletePropertyPhoto(propertyId: string, publicId: string): Promise<PropertyDto> {
  const res = await apiJson<{ property: PropertyDto }>(`/properties/${propertyId}/photos`, {
    method: "DELETE",
    body: JSON.stringify({ publicId }),
  });
  return res.property;
}

export async function listUnits(propertyId: string): Promise<UnitDto[]> {
  const res = await apiJson<{ units: UnitDto[] }>(`/properties/${propertyId}/units`);
  return res.units;
}

export async function createUnit(
  propertyId: string,
  body: {
    label: string;
    rentAmount: number;
    currency?: string;
    status?: "vacant" | "occupied";
  }
): Promise<UnitDto> {
  const res = await apiJson<{ unit: UnitDto }>(`/properties/${propertyId}/units`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.unit;
}

export async function patchUnit(
  unitId: string,
  body: Partial<{
    label: string;
    rentAmount: number;
    currency: string;
    status: "vacant" | "occupied";
  }>
): Promise<UnitDto> {
  const res = await apiJson<{ unit: UnitDto }>(`/units/${unitId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.unit;
}

export async function deleteUnit(unitId: string): Promise<void> {
  const res = await apiFetch(`/units/${unitId}`, { method: "DELETE" });
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
}

export async function listLeases(): Promise<LeaseDto[]> {
  const res = await apiJson<{ leases: LeaseDto[] }>("/leases");
  return res.leases;
}

export async function getLease(leaseId: string): Promise<LeaseDto> {
  const res = await apiJson<{ lease: LeaseDto }>(`/leases/${leaseId}`);
  return res.lease;
}

export async function listLeasePayments(leaseId: string): Promise<RentPaymentDto[]> {
  const res = await apiJson<{ payments: RentPaymentDto[] }>(`/leases/${leaseId}/payments`);
  return res.payments;
}

export async function recordLeasePayment(
  leaseId: string,
  body: {
    amount: number;
    currency?: string;
    paidAt?: string;
    method?: "manual" | "paystack";
    notes?: string;
  }
): Promise<RentPaymentDto> {
  const res = await apiJson<{ payment: RentPaymentDto }>(`/leases/${leaseId}/payments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.payment;
}

export async function getLeaseBalance(leaseId: string, asOf?: string): Promise<LeaseBalanceDto> {
  const q = asOf ? `?asOf=${encodeURIComponent(asOf)}` : "";
  return apiJson<LeaseBalanceDto>(`/leases/${leaseId}/balance${q}`);
}

export async function listInvitations(): Promise<InvitationDto[]> {
  const res = await apiJson<{ invitations: InvitationDto[] }>("/invitations");
  return res.invitations;
}

export async function createInvitation(body: {
  email: string;
  unitId: string;
  startDate: string;
  endDate?: string | null;
  rentAmount?: number;
  currency?: string;
  billingFrequency: "monthly" | "yearly";
}): Promise<{ invitation: InvitationDto; message: string }> {
  return apiJson<{ invitation: InvitationDto; message: string }>("/invitations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listMaintenanceRequests(status?: string): Promise<MaintenanceRequestDto[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await apiJson<{ requests: MaintenanceRequestDto[] }>(`/maintenance-requests${q}`);
  return res.requests;
}

export async function patchMaintenanceRequest(
  requestId: string,
  body: Partial<{
    status: "open" | "in_progress" | "resolved" | "cancelled";
    assignedToUserId: string | null;
    photoUrls: string[];
  }>
): Promise<MaintenanceRequestDto> {
  const res = await apiJson<{ request: MaintenanceRequestDto }>(
    `/maintenance-requests/${requestId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
  return res.request;
}

export async function listNotifications(options?: {
  limit?: number;
  unreadOnly?: boolean;
}): Promise<{ notifications: NotificationDto[]; unreadCount: number }> {
  const sp = new URLSearchParams();
  if (options?.limit) sp.set("limit", String(options.limit));
  if (options?.unreadOnly) sp.set("unreadOnly", "true");
  const q = sp.toString();
  return apiJson<{ notifications: NotificationDto[]; unreadCount: number }>(
    `/notifications${q ? `?${q}` : ""}`
  );
}

export async function markNotificationRead(notificationId: string): Promise<NotificationDto> {
  const res = await apiJson<{ notification: NotificationDto }>(
    `/notifications/${notificationId}/read`,
    { method: "PATCH" }
  );
  return res.notification;
}

export async function markAllNotificationsRead(): Promise<number> {
  const res = await apiJson<{ markedRead: number }>("/notifications/read-all", {
    method: "POST",
  });
  return res.markedRead;
}

export async function getOrganization(): Promise<OrganizationDto> {
  const res = await apiJson<{ organization: OrganizationDto }>("/organization");
  return res.organization;
}

export async function patchOrganization(body: {
  name?: string;
  defaultCurrency?: string;
}): Promise<OrganizationDto> {
  const res = await apiJson<{ organization: OrganizationDto }>("/organization", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.organization;
}

export async function downloadPaymentsCsv(params?: { from?: Date; to?: Date }): Promise<Blob> {
  const sp = new URLSearchParams();
  if (params?.from) sp.set("from", params.from.toISOString());
  if (params?.to) sp.set("to", params.to.toISOString());
  const q = sp.toString();
  const res = await apiFetch(`/reports/payments.csv${q ? `?${q}` : ""}`);
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
