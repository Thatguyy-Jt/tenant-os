import { Router } from "express";
import { z } from "zod";
import { Unit } from "../models/Unit";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { httpError } from "../middleware/errorHandler";
import { requireObjectId } from "../utils/objectId";
import { isMongoDuplicateKeyError, serializeUnit } from "../utils/serializers";
import { assertUnitInStaffScope } from "../services/propertyAccess";

const patchUnitSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  rentAmount: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(["vacant", "occupied"]).optional(),
});

export const unitsRouter = Router();

unitsRouter.use(authenticate, requireRole("landlord", "agent"));

unitsRouter.get(
  "/:unitId",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const unitId = requireObjectId(req.params.unitId, "unitId");
    const unit = await Unit.findOne({ _id: unitId, organizationId: orgId }).lean();
    if (!unit) {
      throw httpError(404, "Unit not found", "NOT_FOUND");
    }
    await assertUnitInStaffScope(orgId, unitId, req.auth!);
    res.json({
      unit: serializeUnit(unit as Record<string, unknown>),
    });
  })
);

unitsRouter.patch(
  "/:unitId",
  asyncHandler(async (req, res) => {
    const body = patchUnitSchema.parse(req.body);
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const unitId = requireObjectId(req.params.unitId, "unitId");
    await assertUnitInStaffScope(orgId, unitId, req.auth!);
    const updates: Record<string, unknown> = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.rentAmount !== undefined) updates.rentAmount = body.rentAmount;
    if (body.currency !== undefined) updates.currency = body.currency.toUpperCase();
    if (body.status !== undefined) updates.status = body.status;
    try {
      const unit = await Unit.findOneAndUpdate(
        { _id: unitId, organizationId: orgId },
        { $set: updates },
        { new: true }
      ).lean();
      if (!unit) {
        throw httpError(404, "Unit not found", "NOT_FOUND");
      }
      res.json({
        unit: serializeUnit(unit as Record<string, unknown>),
      });
    } catch (e: unknown) {
      if (isMongoDuplicateKeyError(e)) {
        throw httpError(
          409,
          "A unit with this label already exists on this property",
          "DUPLICATE_LABEL"
        );
      }
      throw e;
    }
  })
);

unitsRouter.delete(
  "/:unitId",
  requireRole("landlord"),
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const unitId = requireObjectId(req.params.unitId, "unitId");
    const result = await Unit.deleteOne({ _id: unitId, organizationId: orgId });
    if (result.deletedCount === 0) {
      throw httpError(404, "Unit not found", "NOT_FOUND");
    }
    res.status(204).send();
  })
);
