/** JSON shapes for API responses (string ids, stable field names). */

function idString(v: unknown): string {
  if (v != null && typeof v === "object" && "toString" in v && typeof (v as { toString: () => string }).toString === "function") {
    return (v as { toString: () => string }).toString();
  }
  return String(v);
}

function serializePropertyPhotos(raw: unknown): { url: string; publicId: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { url: string; publicId: string }[] = [];
  for (const x of raw) {
    if (x == null || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const url = String(o.url ?? "");
    const publicId = String(o.cloudinaryPublicId ?? "");
    if (url && publicId) out.push({ url, publicId });
  }
  return out;
}

export function serializeProperty(p: Record<string, unknown>) {
  return {
    id: idString(p._id),
    organizationId: idString(p.organizationId),
    name: p.name == null ? null : String(p.name),
    addressLine1: String(p.addressLine1 ?? ""),
    addressLine2: p.addressLine2 == null ? null : String(p.addressLine2),
    city: String(p.city ?? ""),
    state: p.state == null ? null : String(p.state),
    country: String(p.country ?? ""),
    postalCode: p.postalCode == null ? null : String(p.postalCode),
    photos: serializePropertyPhotos(p.propertyPhotos),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function serializeUnit(p: Record<string, unknown>) {
  return {
    id: idString(p._id),
    organizationId: idString(p.organizationId),
    propertyId: idString(p.propertyId),
    label: String(p.label ?? ""),
    rentAmount: Number(p.rentAmount),
    currency: String(p.currency ?? "NGN"),
    status: String(p.status ?? "vacant"),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function serializeLease(l: Record<string, unknown>) {
  return {
    id: idString(l._id),
    organizationId: idString(l.organizationId),
    unitId: idString(l.unitId),
    tenantUserId: idString(l.tenantUserId),
    invitationId: l.invitationId == null ? null : idString(l.invitationId),
    startDate: l.startDate,
    endDate: l.endDate,
    rentAmount: Number(l.rentAmount),
    currency: String(l.currency ?? "NGN"),
    billingFrequency: String(l.billingFrequency),
    status: String(l.status ?? "active"),
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}

export function serializeRentPayment(p: Record<string, unknown>) {
  return {
    id: idString(p._id),
    organizationId: idString(p.organizationId),
    leaseId: idString(p.leaseId),
    amount: Number(p.amount),
    currency: String(p.currency ?? "NGN"),
    paidAt: p.paidAt,
    method: String(p.method ?? "manual"),
    recordedBy: p.recordedBy == null ? null : idString(p.recordedBy),
    notes: p.notes == null ? "" : String(p.notes),
    paystackReference: p.paystackReference == null ? null : String(p.paystackReference),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function serializeLeaseDocument(d: Record<string, unknown>) {
  return {
    id: idString(d._id),
    organizationId: idString(d.organizationId),
    leaseId: idString(d.leaseId),
    uploadedBy: idString(d.uploadedBy),
    label: String(d.label ?? ""),
    cloudinaryUrl: String(d.cloudinaryUrl ?? ""),
    originalFileName: String(d.originalFileName ?? ""),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export function serializeMaintenanceRequest(m: Record<string, unknown>) {
  const photos = m.photoUrls;
  const assigned = m.assignedToUserId;
  return {
    id: idString(m._id),
    organizationId: idString(m.organizationId),
    unitId: idString(m.unitId),
    leaseId: idString(m.leaseId),
    tenantUserId: idString(m.tenantUserId),
    title: String(m.title ?? ""),
    description: String(m.description ?? ""),
    priority: String(m.priority ?? "normal"),
    status: String(m.status ?? "open"),
    photoUrls: Array.isArray(photos) ? photos.map((u) => String(u)) : [],
    assignedToUserId:
      assigned == null ? null : typeof assigned === "object" ? idString(assigned) : String(assigned),
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

export function serializeInvitation(i: Record<string, unknown>) {
  return {
    id: idString(i._id),
    organizationId: idString(i.organizationId),
    unitId: idString(i.unitId),
    email: String(i.email ?? ""),
    expiresAt: i.expiresAt,
    consumedAt: i.consumedAt,
    startDate: i.startDate,
    endDate: i.endDate,
    rentAmount: Number(i.rentAmount),
    currency: String(i.currency ?? "NGN"),
    billingFrequency: String(i.billingFrequency),
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

export function serializeOrganization(o: Record<string, unknown>) {
  return {
    id: idString(o._id),
    name: String(o.name ?? ""),
    defaultCurrency: String(o.defaultCurrency ?? "NGN").toUpperCase(),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export function serializeNotification(n: Record<string, unknown>) {
  const meta = n.metadata;
  return {
    id: idString(n._id),
    organizationId: idString(n.organizationId),
    type: String(n.type ?? ""),
    title: String(n.title ?? ""),
    body: String(n.body ?? ""),
    readAt: n.readAt ?? null,
    metadata: meta != null && typeof meta === "object" ? meta : {},
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

export function isMongoDuplicateKeyError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: number }).code === 11000;
}
