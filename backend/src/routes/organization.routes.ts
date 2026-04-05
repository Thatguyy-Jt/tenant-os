import { Router } from "express";
import { z } from "zod";
import { Organization } from "../models/Organization";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { httpError } from "../middleware/errorHandler";
import { requireObjectId } from "../utils/objectId";
import { serializeOrganization } from "../utils/serializers";

const patchOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  defaultCurrency: z.string().length(3).optional(),
});

export const organizationRouter = Router();

organizationRouter.use(authenticate, requireRole("landlord"));

organizationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const org = await Organization.findById(orgId).lean();
    if (!org || Array.isArray(org)) {
      throw httpError(404, "Organization not found", "NOT_FOUND");
    }
    res.json({
      organization: serializeOrganization(org as Record<string, unknown>),
    });
  })
);

organizationRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const body = patchOrgSchema.parse(req.body);
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");

    const $set: Record<string, unknown> = {};
    if (body.name !== undefined) $set.name = body.name;
    if (body.defaultCurrency !== undefined) $set.defaultCurrency = body.defaultCurrency.toUpperCase();

    if (Object.keys($set).length === 0) {
      throw httpError(400, "No updates provided", "VALIDATION");
    }

    const org = await Organization.findByIdAndUpdate(orgId, { $set }, { new: true }).lean();
    if (!org || Array.isArray(org)) {
      throw httpError(404, "Organization not found", "NOT_FOUND");
    }

    res.json({
      organization: serializeOrganization(org as Record<string, unknown>),
    });
  })
);
