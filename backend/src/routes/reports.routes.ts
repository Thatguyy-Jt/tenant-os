import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { RentPayment } from "../models/RentPayment";
import { Lease } from "../models/Lease";
import { User } from "../models/User";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { requireObjectId } from "../utils/objectId";
import { getStaffPropertyScope, unitIdsInStaffScope } from "../services/propertyAccess";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const paymentsExportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const reportsRouter = Router();

reportsRouter.use(authenticate, requireRole("landlord", "agent"));

reportsRouter.get(
  "/payments.csv",
  asyncHandler(async (req, res) => {
    const q = paymentsExportQuerySchema.parse(req.query);
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const auth = req.auth!;

    const to = q.to ?? new Date();
    const from = q.from ?? new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);

    const scope = await getStaffPropertyScope(auth.userId, auth.role);
    const unitScope = await unitIdsInStaffScope(orgId, scope);

    let leaseIds: mongoose.Types.ObjectId[] | null = null;
    if (unitScope !== null) {
      if (unitScope.length === 0) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="tenantos-payments.csv"');
        res.send("paidAt,amount,currency,method,leaseId,tenantEmail,paystackReference,notes\n");
        return;
      }
      const leases = await Lease.find({
        organizationId: orgId,
        unitId: { $in: unitScope },
      })
        .select("_id")
        .lean();
      leaseIds = leases.map((l) => l._id as mongoose.Types.ObjectId);
      if (leaseIds.length === 0) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="tenantos-payments.csv"');
        res.send("paidAt,amount,currency,method,leaseId,tenantEmail,paystackReference,notes\n");
        return;
      }
    }

    const filter: Record<string, unknown> = {
      organizationId: orgId,
      paidAt: { $gte: from, $lte: to },
    };
    if (leaseIds !== null) {
      filter.leaseId = { $in: leaseIds };
    }

    const rows = await RentPayment.find(filter).sort({ paidAt: -1 }).lean();

    const leaseIdSet = new Set(rows.map((r) => String((r as Record<string, unknown>).leaseId)));
    const leaseDocs = await Lease.find({
      _id: { $in: [...leaseIdSet].map((id) => new mongoose.Types.ObjectId(id)) },
      organizationId: orgId,
    })
      .select("tenantUserId")
      .lean();
    const tenantByLease = new Map<string, mongoose.Types.ObjectId>();
    for (const le of leaseDocs) {
      tenantByLease.set(String(le._id), le.tenantUserId as mongoose.Types.ObjectId);
    }

    const tenantIds = [...new Set([...tenantByLease.values()].map((id) => String(id)))].map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const tenants =
      tenantIds.length === 0
        ? []
        : await User.find({ _id: { $in: tenantIds } })
            .select("email")
            .lean();
    const emailByUser = new Map<string, string>();
    for (const t of tenants) {
      emailByUser.set(String(t._id), String((t as { email?: string }).email ?? ""));
    }

    const header = "paidAt,amount,currency,method,leaseId,tenantEmail,paystackReference,notes";
    const lines = rows.map((row) => {
      const p = row as Record<string, unknown>;
      const lid = String(p.leaseId);
      const tid = tenantByLease.get(lid);
      const email = tid ? emailByUser.get(String(tid)) ?? "" : "";
      return [
        csvEscape(new Date(p.paidAt as Date).toISOString()),
        csvEscape(String(Number(p.amount))),
        csvEscape(String(p.currency ?? "")),
        csvEscape(String(p.method ?? "")),
        csvEscape(lid),
        csvEscape(email),
        p.paystackReference != null ? csvEscape(String(p.paystackReference)) : "",
        csvEscape(String(p.notes ?? "")),
      ].join(",");
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="tenantos-payments.csv"');
    res.send([header, ...lines].join("\n"));
  })
);
