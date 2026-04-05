import { Router } from "express";
import { z } from "zod";
import { Lease } from "../models/Lease";
import { Unit } from "../models/Unit";
import { RentPayment } from "../models/RentPayment";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { requireObjectId } from "../utils/objectId";
import { computeBalance, computeExpectedRentThrough, sumPayments } from "../services/rent";
import { getStaffPropertyScope, unitIdsInStaffScope } from "../services/propertyAccess";

const summaryQuerySchema = z.object({
  revenueFrom: z.coerce.date().optional(),
  revenueTo: z.coerce.date().optional(),
});

export const dashboardRouter = Router();

dashboardRouter.use(authenticate, requireRole("landlord", "agent"));

dashboardRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const auth = req.auth!;
    const q = summaryQuerySchema.parse(req.query);

    const to = q.revenueTo ?? new Date();
    const from =
      q.revenueFrom ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    const scope = await getStaffPropertyScope(auth.userId, auth.role);
    const unitScope = await unitIdsInStaffScope(orgId, scope);

    if (unitScope !== null && unitScope.length === 0) {
      res.json({
        occupancy: {
          totalUnits: 0,
          occupiedUnits: 0,
          occupancyRatePercent: 0,
        },
        revenue: {
          total: 0,
          from: from.toISOString(),
          to: to.toISOString(),
        },
        overdue: {
          activeLeaseCount: 0,
          leasesWithBalanceDue: 0,
          totalOutstanding: 0,
        },
      });
      return;
    }

    const unitMatch: Record<string, unknown> = { organizationId: orgId };
    if (unitScope !== null) {
      unitMatch._id = { $in: unitScope };
    }

    const leaseScopeFilter: Record<string, unknown> = { organizationId: orgId };
    if (unitScope !== null) {
      leaseScopeFilter.unitId = { $in: unitScope };
    }

    const scopedLeases = await Lease.find(leaseScopeFilter).select("_id").lean();
    const scopedLeaseIds = scopedLeases.map((l) => l._id);

    const [totalUnits, occupiedUnits, revenueAgg] = await Promise.all([
      Unit.countDocuments(unitMatch),
      Unit.countDocuments({ ...unitMatch, status: "occupied" }),
      scopedLeaseIds.length === 0
        ? Promise.resolve([] as { total: number }[])
        : RentPayment.aggregate<{ total: number }>([
            {
              $match: {
                organizationId: orgId,
                leaseId: { $in: scopedLeaseIds },
                paidAt: { $gte: from, $lte: to },
              },
            },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ]),
    ]);

    const occupancyRate =
      totalUnits === 0 ? 0 : Math.round((occupiedUnits / totalUnits) * 10000) / 100;

    const totalRevenue =
      revenueAgg.length > 0 ? Math.round((revenueAgg[0].total ?? 0) * 100) / 100 : 0;

    const activeLeases = await Lease.find({
      ...leaseScopeFilter,
      status: "active",
    }).lean();

    const leaseIds = activeLeases.map((l) => l._id);
    const payments =
      leaseIds.length === 0
        ? []
        : await RentPayment.find({ leaseId: { $in: leaseIds } }).lean();

    const paidByLease = new Map<string, number>();
    for (const p of payments) {
      const lid = String(p.leaseId);
      paidByLease.set(lid, (paidByLease.get(lid) ?? 0) + p.amount);
    }

    const asOf = new Date();
    let overdueLeaseCount = 0;
    let overdueRentTotal = 0;

    for (const lease of activeLeases) {
      const l = lease as Record<string, unknown>;
      const expected = computeExpectedRentThrough(
        {
          startDate: l.startDate as Date,
          endDate: (l.endDate as Date | null) ?? null,
          rentAmount: Number(l.rentAmount),
          billingFrequency: l.billingFrequency as "monthly" | "yearly",
        },
        asOf
      );
      const totalPaid = paidByLease.get(String(l._id)) ?? 0;
      const balance = computeBalance(expected, totalPaid);
      if (balance > 0) {
        overdueLeaseCount += 1;
        overdueRentTotal += balance;
      }
    }

    overdueRentTotal = Math.round(overdueRentTotal * 100) / 100;

    res.json({
      occupancy: {
        totalUnits,
        occupiedUnits,
        occupancyRatePercent: occupancyRate,
      },
      revenue: {
        total: totalRevenue,
        from: from.toISOString(),
        to: to.toISOString(),
      },
      overdue: {
        activeLeaseCount: activeLeases.length,
        leasesWithBalanceDue: overdueLeaseCount,
        totalOutstanding: overdueRentTotal,
      },
    });
  })
);
