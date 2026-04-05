import { Router } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { User } from "../models/User";
import { Unit } from "../models/Unit";
import { Organization } from "../models/Organization";
import { Invitation, BILLING_FREQUENCIES } from "../models/Invitation";
import { Lease } from "../models/Lease";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { httpError } from "../middleware/errorHandler";
import { requireObjectId } from "../utils/objectId";
import { generateInviteToken, hashInviteToken } from "../utils/inviteToken";
import { loadEnv } from "../config/env";
import { buildAuthResponse } from "../services/authSession";
import { sendTenantInvitationEmail } from "../services/email";
import { serializeInvitation, serializeLease } from "../utils/serializers";
import {
  assertPropertyInStaffScope,
  getStaffPropertyScope,
  unitIdsInStaffScope,
} from "../services/propertyAccess";

const createInvitationSchema = z.object({
  email: z.string().email(),
  unitId: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  rentAmount: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  billingFrequency: z.enum(BILLING_FREQUENCIES),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const invitationsRouter = Router();

/** Public: accept invite and create tenant user + lease. */
invitationsRouter.post(
  "/accept",
  asyncHandler(async (req, res) => {
    const body = acceptInvitationSchema.parse(req.body);
    const digest = hashInviteToken(body.token);

    const invitation = await Invitation.findOne({ tokenDigest: digest });
    if (!invitation) {
      throw httpError(400, "Invalid or unknown invitation token", "INVALID_TOKEN");
    }
    if (invitation.consumedAt) {
      throw httpError(400, "This invitation has already been used", "INVITE_USED");
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw httpError(400, "This invitation has expired", "INVITE_EXPIRED");
    }

    const existingUser = await User.findOne({ email: invitation.email });
    if (existingUser) {
      throw httpError(409, "An account with this email already exists", "EMAIL_IN_USE");
    }

    const unit = await Unit.findOne({
      _id: invitation.unitId,
      organizationId: invitation.organizationId,
    });
    if (!unit) {
      throw httpError(409, "Unit is no longer available", "UNIT_UNAVAILABLE");
    }
    if (unit.status !== "vacant") {
      throw httpError(409, "Unit is no longer vacant", "UNIT_NOT_VACANT");
    }

    const activeLease = await Lease.findOne({
      unitId: unit._id,
      status: "active",
    });
    if (activeLease) {
      throw httpError(409, "Unit already has an active lease", "UNIT_HAS_LEASE");
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const session = await mongoose.startSession();

    try {
      const outcome = await session.withTransaction(async () => {
        const [user] = await User.create(
          [
            {
              email: invitation.email,
              passwordHash,
              role: "tenant",
              organizationId: invitation.organizationId,
              emailVerified: true,
            },
          ],
          { session }
        );

        const [leaseDoc] = await Lease.create(
          [
            {
              organizationId: invitation.organizationId,
              unitId: invitation.unitId,
              tenantUserId: user._id,
              invitationId: invitation._id,
              startDate: invitation.startDate,
              endDate: invitation.endDate ?? null,
              rentAmount: invitation.rentAmount,
              currency: invitation.currency,
              billingFrequency: invitation.billingFrequency,
              status: "active",
            },
          ],
          { session }
        );

        const unitUpdate = await Unit.findOneAndUpdate(
          { _id: unit._id, organizationId: invitation.organizationId, status: "vacant" },
          { $set: { status: "occupied" } },
          { new: true, session }
        );
        if (!unitUpdate) {
          throw httpError(409, "Unit is no longer vacant", "UNIT_NOT_VACANT");
        }

        const invUpdate = await Invitation.findOneAndUpdate(
          { _id: invitation._id, consumedAt: null },
          { $set: { consumedAt: new Date() } },
          { new: true, session }
        );
        if (!invUpdate) {
          throw httpError(400, "Invitation could not be completed", "INVITE_CONFLICT");
        }

        return { user, leaseDoc };
      });

      if (!outcome) {
        throw httpError(500, "Transaction did not complete", "TRANSACTION_FAILED");
      }

      const { user: createdUser, leaseDoc } = outcome;

      const auth = await buildAuthResponse(createdUser);

      res.status(201).json({
        ...auth,
        user: {
          ...auth.user,
          email: invitation.email,
        },
        lease: serializeLease(leaseDoc.toObject() as Record<string, unknown>),
      });
    } finally {
      await session.endSession();
    }
  })
);

invitationsRouter.use(authenticate, requireRole("landlord", "agent"));

invitationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const auth = req.auth!;
    const now = new Date();
    const scope = await getStaffPropertyScope(auth.userId, auth.role);
    const unitScope = await unitIdsInStaffScope(orgId, scope);
    const filter: Record<string, unknown> = {
      organizationId: orgId,
      consumedAt: null,
      expiresAt: { $gt: now },
    };
    if (unitScope !== null) {
      if (unitScope.length === 0) {
        res.json({ invitations: [] });
        return;
      }
      filter.unitId = { $in: unitScope };
    }
    const list = await Invitation.find(filter).sort({ createdAt: -1 }).lean();
    res.json({
      invitations: list.map((i) => serializeInvitation(i as Record<string, unknown>)),
    });
  })
);

invitationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createInvitationSchema.parse(req.body);
    const env = loadEnv();
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const auth = req.auth!;

    const unit = await Unit.findOne({ _id: body.unitId, organizationId: orgId });
    if (!unit) {
      throw httpError(404, "Unit not found", "NOT_FOUND");
    }
    if (auth.role === "agent") {
      const scope = await getStaffPropertyScope(auth.userId, auth.role);
      await assertPropertyInStaffScope(orgId, unit.propertyId as mongoose.Types.ObjectId, scope);
    }
    if (unit.status !== "vacant") {
      throw httpError(409, "Unit is not vacant", "UNIT_NOT_VACANT");
    }

    const activeLease = await Lease.findOne({ unitId: unit._id, status: "active" });
    if (activeLease) {
      throw httpError(409, "Unit already has an active lease", "UNIT_HAS_LEASE");
    }

    const pendingForUnit = await Invitation.findOne({
      unitId: unit._id,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (pendingForUnit) {
      throw httpError(409, "A pending invitation already exists for this unit", "INVITE_PENDING");
    }

    const emailNorm = body.email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: emailNorm });
    if (existingUser) {
      throw httpError(409, "An account with this email already exists", "EMAIL_IN_USE");
    }

    const pendingForEmail = await Invitation.findOne({
      organizationId: orgId,
      email: emailNorm,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (pendingForEmail) {
      throw httpError(409, "A pending invitation already exists for this email", "INVITE_PENDING_EMAIL");
    }

    const rentAmount = body.rentAmount ?? unit.rentAmount;
    const currency = (body.currency ?? unit.currency).toUpperCase();

    const plainToken = generateInviteToken();
    const tokenDigest = hashInviteToken(plainToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.INVITE_EXPIRES_DAYS);

    const invitation = await Invitation.create({
      organizationId: orgId,
      unitId: unit._id,
      email: emailNorm,
      tokenDigest,
      expiresAt,
      createdBy: requireObjectId(auth.userId, "userId"),
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      rentAmount,
      currency,
      billingFrequency: body.billingFrequency,
    });

    const org = await Organization.findById(orgId).lean();
    const orgName = org && !Array.isArray(org) ? String((org as { name?: string }).name ?? "Your landlord") : "Your landlord";

    const base = env.APP_PUBLIC_URL.replace(/\/$/, "");
    const inviteUrl = `${base}/tenant/accept?token=${encodeURIComponent(plainToken)}`;

    await sendTenantInvitationEmail({
      to: emailNorm,
      inviteUrl,
      organizationName: orgName,
      unitLabel: unit.label,
    });

    res.status(201).json({
      invitation: serializeInvitation(invitation.toObject() as Record<string, unknown>),
      message: env.SMTP_HOST
        ? "Invitation email sent."
        : "Invitation created; email was not sent (configure SMTP_HOST). Check server logs for the invite link.",
    });
  })
);
