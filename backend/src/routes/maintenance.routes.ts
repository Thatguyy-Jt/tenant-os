import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { MaintenanceRequest } from "../models/MaintenanceRequest";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { httpError } from "../middleware/errorHandler";
import { requireObjectId } from "../utils/objectId";
import { serializeMaintenanceRequest } from "../utils/serializers";
import { assertUnitInStaffScope, getStaffPropertyScope, unitIdsInStaffScope } from "../services/propertyAccess";
import { notifyMaintenanceUpdated } from "../services/inAppNotifications";

const statusValues = ["open", "in_progress", "resolved", "cancelled"] as const;

const listQuerySchema = z.object({
  status: z.enum(statusValues).optional(),
});

const patchRequestSchema = z.object({
  status: z.enum(statusValues).optional(),
  assignedToUserId: z.string().nullable().optional(),
  photoUrls: z.array(z.string().min(1).max(2000)).max(20).optional(),
});

export const maintenanceRouter = Router();

maintenanceRouter.use(authenticate, requireRole("landlord", "agent"));

maintenanceRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listQuerySchema.parse(req.query);
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const auth = req.auth!;
    const scope = await getStaffPropertyScope(auth.userId, auth.role);
    const unitScope = await unitIdsInStaffScope(orgId, scope);

    const filter: Record<string, unknown> = { organizationId: orgId };
    if (q.status) {
      filter.status = q.status;
    }
    if (unitScope !== null) {
      if (unitScope.length === 0) {
        res.json({ requests: [] });
        return;
      }
      filter.unitId = { $in: unitScope };
    }

    const rows = await MaintenanceRequest.find(filter).sort({ createdAt: -1 }).lean();
    res.json({
      requests: rows.map((r) => serializeMaintenanceRequest(r as Record<string, unknown>)),
    });
  })
);

maintenanceRouter.get(
  "/:requestId",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const requestId = requireObjectId(req.params.requestId, "requestId");

    const row = await MaintenanceRequest.findOne({ _id: requestId, organizationId: orgId }).lean();
    if (!row) {
      throw httpError(404, "Maintenance request not found", "NOT_FOUND");
    }
    const unitId = (row as unknown as { unitId: mongoose.Types.ObjectId }).unitId;
    await assertUnitInStaffScope(orgId, unitId, req.auth!);

    res.json({
      request: serializeMaintenanceRequest(row as Record<string, unknown>),
    });
  })
);

maintenanceRouter.patch(
  "/:requestId",
  asyncHandler(async (req, res) => {
    const body = patchRequestSchema.parse(req.body);
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const requestId = requireObjectId(req.params.requestId, "requestId");
    const auth = req.auth!;

    const existing = await MaintenanceRequest.findOne({ _id: requestId, organizationId: orgId });
    if (!existing) {
      throw httpError(404, "Maintenance request not found", "NOT_FOUND");
    }
    await assertUnitInStaffScope(orgId, existing.unitId as mongoose.Types.ObjectId, auth);

    const $set: Record<string, unknown> = {};
    if (body.status !== undefined) $set.status = body.status;
    if (body.photoUrls !== undefined) $set.photoUrls = body.photoUrls;
    if (body.assignedToUserId !== undefined) {
      $set.assignedToUserId =
        body.assignedToUserId === null
          ? null
          : requireObjectId(body.assignedToUserId, "assignedToUserId");
    }

    if (Object.keys($set).length === 0) {
      throw httpError(400, "No updates provided", "VALIDATION");
    }

    const updated = await MaintenanceRequest.findOneAndUpdate(
      { _id: requestId, organizationId: orgId },
      { $set },
      { new: true }
    ).lean();

    if (!updated) {
      throw httpError(404, "Maintenance request not found", "NOT_FOUND");
    }

    if (
      body.status !== undefined &&
      String(existing.status) !== body.status
    ) {
      await notifyMaintenanceUpdated({
        tenantUserId: existing.tenantUserId as mongoose.Types.ObjectId,
        organizationId: orgId,
        requestId: existing._id as mongoose.Types.ObjectId,
        newStatus: body.status,
        title: String(existing.title),
      });
    }

    res.json({
      request: serializeMaintenanceRequest(updated as Record<string, unknown>),
    });
  })
);
