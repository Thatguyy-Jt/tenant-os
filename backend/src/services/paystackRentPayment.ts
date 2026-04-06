import mongoose from "mongoose";
import { Lease } from "../models/Lease";
import { RentPayment } from "../models/RentPayment";
import { notifyPaymentReceived } from "./inAppNotifications";

function metaString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/**
 * Paystack returns `metadata` as sent on initialize; some payloads nest values in `custom_fields`.
 */
export function extractPaystackLeaseMetadata(meta: Record<string, unknown>): {
  leaseIdStr: string | null;
  orgIdStr: string | null;
} {
  let leaseIdStr =
    metaString(meta.lease_id) ??
    metaString(meta.leaseId) ??
    null;
  let orgIdStr =
    metaString(meta.organization_id) ??
    metaString(meta.organizationId) ??
    null;

  const cf = meta.custom_fields;
  if (Array.isArray(cf)) {
    for (const row of cf) {
      if (row == null || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const name = String(r.variable_name ?? r.variableName ?? "");
      const value = metaString(r.value);
      if (!value) continue;
      if (name === "lease_id") leaseIdStr = leaseIdStr ?? value;
      if (name === "organization_id") orgIdStr = orgIdStr ?? value;
    }
  }

  return { leaseIdStr, orgIdStr };
}

export type PaystackChargeInput = {
  reference: string;
  amountKobo: number;
  currency: string;
  paidAt: Date;
  metadata: Record<string, unknown>;
};

export type RecordPaystackResult =
  | { kind: "duplicate" }
  | { kind: "created" }
  | { kind: "error"; code: "missing_metadata" | "invalid_ids" | "lease_not_found" | "currency_mismatch" };

/**
 * Idempotent: same Paystack reference only creates one `RentPayment`.
 * Used by the webhook (HMAC-trusted) and by `/tenant/paystack/verify` after API verification.
 */
export async function recordPaystackRentPaymentIfNew(input: PaystackChargeInput): Promise<RecordPaystackResult> {
  const existing = await RentPayment.findOne({ paystackReference: input.reference });
  if (existing) {
    return { kind: "duplicate" };
  }

  const { leaseIdStr, orgIdStr } = extractPaystackLeaseMetadata(input.metadata);
  if (!leaseIdStr || !orgIdStr) {
    return { kind: "error", code: "missing_metadata" };
  }

  if (!mongoose.isValidObjectId(leaseIdStr) || !mongoose.isValidObjectId(orgIdStr)) {
    return { kind: "error", code: "invalid_ids" };
  }

  const lease = await Lease.findOne({
    _id: new mongoose.Types.ObjectId(leaseIdStr),
    organizationId: new mongoose.Types.ObjectId(orgIdStr),
  });

  if (!lease) {
    return { kind: "error", code: "lease_not_found" };
  }

  const currency = input.currency.toUpperCase();
  if (currency !== lease.currency) {
    return { kind: "error", code: "currency_mismatch" };
  }

  const amountNgn = Math.round(input.amountKobo) / 100;

  await RentPayment.create({
    organizationId: lease.organizationId,
    leaseId: lease._id,
    amount: amountNgn,
    currency: lease.currency,
    paidAt: input.paidAt,
    method: "paystack",
    recordedBy: null,
    notes: "Paystack",
    paystackReference: input.reference,
  });

  await notifyPaymentReceived({
    tenantUserId: lease.tenantUserId as mongoose.Types.ObjectId,
    organizationId: lease.organizationId as mongoose.Types.ObjectId,
    amount: amountNgn,
    currency: lease.currency,
    leaseId: lease._id as mongoose.Types.ObjectId,
  });

  return { kind: "created" };
}
