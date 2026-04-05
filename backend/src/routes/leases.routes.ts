import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Lease } from "../models/Lease";
import { LeaseDocument } from "../models/LeaseDocument";
import { RentPayment } from "../models/RentPayment";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { httpError } from "../middleware/errorHandler";
import { requireObjectId } from "../utils/objectId";
import { serializeLease, serializeRentPayment, serializeLeaseDocument } from "../utils/serializers";
import { assertLeaseInStaffScope, getStaffPropertyScope, unitIdsInStaffScope } from "../services/propertyAccess";
import {
  computeBalance,
  computeExpectedRentThrough,
  sumPayments,
} from "../services/rent";
import { notifyPaymentReceived } from "../services/inAppNotifications";

const createPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).optional(),
  paidAt: z.coerce.date().optional(),
  method: z.enum(["manual", "paystack"]).default("manual"),
  notes: z.string().max(2000).optional(),
});

const balanceQuerySchema = z.object({
  asOf: z.coerce.date().optional(),
});

function pickId(ref: unknown): unknown {
  if (ref != null && typeof ref === "object" && "_id" in ref) {
    return (ref as { _id: unknown })._id;
  }
  return ref;
}

function leaseRowForSerializer(row: Record<string, unknown>): Record<string, unknown> {
  return {
    _id: row._id,
    organizationId: row.organizationId,
    unitId: pickId(row.unitId),
    tenantUserId: pickId(row.tenantUserId),
    invitationId: row.invitationId,
    startDate: row.startDate,
    endDate: row.endDate,
    rentAmount: row.rentAmount,
    currency: row.currency,
    billingFrequency: row.billingFrequency,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const leasesRouter = Router();

leasesRouter.use(authenticate, requireRole("landlord", "agent"));

leasesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const auth = req.auth!;
    const scope = await getStaffPropertyScope(auth.userId, auth.role);
    const unitScope = await unitIdsInStaffScope(orgId, scope);
    const leaseFilter: Record<string, unknown> = { organizationId: orgId };
    if (unitScope !== null) {
      if (unitScope.length === 0) {
        res.json({ leases: [] });
        return;
      }
      leaseFilter.unitId = { $in: unitScope };
    }
    const rows = await Lease.find(leaseFilter)
      .populate("tenantUserId", "email")
      .populate("unitId", "label propertyId")
      .sort({ createdAt: -1 })
      .lean();

    const leases = rows.map((row) => {
      const r = row as Record<string, unknown>;
      const base = serializeLease(leaseRowForSerializer(r));
      const tenant = r.tenantUserId as { email?: string } | null;
      const unit = r.unitId as { label?: string } | null;
      return {
        ...base,
        tenantEmail: tenant?.email ?? null,
        unitLabel: unit?.label ?? null,
      };
    });

    res.json({ leases });
  })
);

leasesRouter.get(
  "/:leaseId/payments",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const leaseId = requireObjectId(req.params.leaseId, "leaseId");
    const lease = await Lease.findOne({ _id: leaseId, organizationId: orgId }).lean();
    if (!lease) {
      throw httpError(404, "Lease not found", "NOT_FOUND");
    }
    await assertLeaseInStaffScope(orgId, lease as unknown as { unitId: unknown }, req.auth!);
    const rows = await RentPayment.find({ leaseId, organizationId: orgId })
      .sort({ paidAt: -1 })
      .lean();
    res.json({
      payments: rows.map((p) => serializeRentPayment(p as Record<string, unknown>)),
    });
  })
);

leasesRouter.post(
  "/:leaseId/payments",
  asyncHandler(async (req, res) => {
    const body = createPaymentSchema.parse(req.body);
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const leaseId = requireObjectId(req.params.leaseId, "leaseId");
    const auth = req.auth!;

    const lease = await Lease.findOne({ _id: leaseId, organizationId: orgId });
    if (!lease) {
      throw httpError(404, "Lease not found", "NOT_FOUND");
    }
    await assertLeaseInStaffScope(orgId, { unitId: lease.unitId as mongoose.Types.ObjectId }, auth);

    const currency = (body.currency ?? lease.currency).toUpperCase();
    if (currency !== lease.currency) {
      throw httpError(400, "Currency must match the lease currency", "CURRENCY_MISMATCH");
    }

    const paidAt = body.paidAt ?? new Date();
    const payment = await RentPayment.create({
      organizationId: orgId,
      leaseId,
      amount: body.amount,
      currency,
      paidAt,
      method: body.method,
      recordedBy: requireObjectId(auth.userId, "userId"),
      notes: body.notes ?? "",
    });

    await notifyPaymentReceived({
      tenantUserId: lease.tenantUserId as mongoose.Types.ObjectId,
      organizationId: orgId,
      amount: body.amount,
      currency,
      leaseId,
    });

    res.status(201).json({
      payment: serializeRentPayment(payment.toObject() as Record<string, unknown>),
    });
  })
);

leasesRouter.get(
  "/:leaseId/balance",
  asyncHandler(async (req, res) => {
    const q = balanceQuerySchema.parse(req.query);
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const leaseId = requireObjectId(req.params.leaseId, "leaseId");

    const lease = await Lease.findOne({ _id: leaseId, organizationId: orgId }).lean();
    if (!lease) {
      throw httpError(404, "Lease not found", "NOT_FOUND");
    }
    await assertLeaseInStaffScope(orgId, lease as unknown as { unitId: unknown }, req.auth!);

    const l = lease as Record<string, unknown>;
    const asOf = q.asOf ?? new Date();
    const expectedTotal = computeExpectedRentThrough(
      {
        startDate: l.startDate as Date,
        endDate: (l.endDate as Date | null) ?? null,
        rentAmount: Number(l.rentAmount),
        billingFrequency: l.billingFrequency as "monthly" | "yearly",
      },
      asOf
    );

    const payments = await RentPayment.find({ leaseId, organizationId: orgId }).lean();
    const totalPaid = sumPayments(
      payments.map((p) => ({
        amount: Number((p as Record<string, unknown>).amount),
      }))
    );
    const balance = computeBalance(expectedTotal, totalPaid);

    res.json({
      leaseId: String(l._id),
      asOf: asOf.toISOString(),
      currency: String(l.currency),
      expectedTotal,
      totalPaid,
      balance,
      billingFrequency: String(l.billingFrequency),
    });
  })
);

leasesRouter.get(
  "/:leaseId/documents",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const leaseId = requireObjectId(req.params.leaseId, "leaseId");

    const lease = await Lease.findOne({ _id: leaseId, organizationId: orgId }).lean();
    if (!lease) {
      throw httpError(404, "Lease not found", "NOT_FOUND");
    }
    await assertLeaseInStaffScope(orgId, lease as unknown as { unitId: unknown }, req.auth!);

    const rows = await LeaseDocument.find({ leaseId, organizationId: orgId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      documents: rows.map((d) => serializeLeaseDocument(d as Record<string, unknown>)),
    });
  })
);

leasesRouter.get(
  "/:leaseId",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const leaseId = requireObjectId(req.params.leaseId, "leaseId");
    const row = await Lease.findOne({ _id: leaseId, organizationId: orgId })
      .populate("tenantUserId", "email")
      .populate("unitId", "label propertyId")
      .lean();
    if (!row) {
      throw httpError(404, "Lease not found", "NOT_FOUND");
    }
    await assertLeaseInStaffScope(orgId, row as unknown as { unitId: unknown }, req.auth!);
    const r = row as Record<string, unknown>;
    const base = serializeLease(leaseRowForSerializer(r));
    const tenant = r.tenantUserId as { email?: string } | null;
    const unit = r.unitId as { label?: string } | null;
    res.json({
      lease: {
        ...base,
        tenantEmail: tenant?.email ?? null,
        unitLabel: unit?.label ?? null,
      },
    });
  })
);
