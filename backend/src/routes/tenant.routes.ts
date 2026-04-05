import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { Lease } from "../models/Lease";
import { User } from "../models/User";
import { LeaseDocument } from "../models/LeaseDocument";
import { Unit } from "../models/Unit";
import { Property } from "../models/Property";
import { RentPayment } from "../models/RentPayment";
import { MaintenanceRequest } from "../models/MaintenanceRequest";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { httpError } from "../middleware/errorHandler";
import { requireObjectId } from "../utils/objectId";
import {
  serializeLease,
  serializeUnit,
  serializeProperty,
  serializeRentPayment,
  serializeMaintenanceRequest,
  serializeLeaseDocument,
} from "../utils/serializers";
import { computeBalance, computeExpectedRentThrough, sumPayments } from "../services/rent";
import { loadEnv } from "../config/env";
import { paystackInitialize } from "../services/paystackApi";
import { uploadLeaseDocument } from "../services/cloudinaryUpload";

const balanceQuerySchema = z.object({
  asOf: z.coerce.date().optional(),
});

const createMaintenanceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(8000),
  priority: z.enum(["low", "normal", "high"]).optional(),
  photoUrls: z.array(z.string().min(1).max(2000)).max(20).optional(),
});

const paystackInitSchema = z.object({
  amountNgn: z.number().positive(),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const tenantRouter = Router();

tenantRouter.use(authenticate, requireRole("tenant"));

/** Current tenant's active lease with unit and property summary. */
tenantRouter.get(
  "/lease",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const userId = requireObjectId(req.auth!.userId, "userId");

    const leaseDoc = await Lease.findOne({
      organizationId: orgId,
      tenantUserId: userId,
      status: "active",
    }).lean();

    if (!leaseDoc || Array.isArray(leaseDoc)) {
      throw httpError(404, "No active lease found", "NOT_FOUND");
    }

    const lease = leaseDoc as Record<string, unknown>;

    const unit = await Unit.findOne({
      _id: lease.unitId,
      organizationId: orgId,
    }).lean();
    if (!unit || Array.isArray(unit)) {
      throw httpError(404, "Unit not found", "NOT_FOUND");
    }

    const u = unit as Record<string, unknown>;

    const property = await Property.findOne({
      _id: u.propertyId,
      organizationId: orgId,
    }).lean();
    if (!property || Array.isArray(property)) {
      throw httpError(404, "Property not found", "NOT_FOUND");
    }

    res.json({
      lease: serializeLease(lease),
      unit: serializeUnit(u),
      property: serializeProperty(property as Record<string, unknown>),
    });
  })
);

tenantRouter.get(
  "/payments",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const userId = requireObjectId(req.auth!.userId, "userId");

    const lease = await Lease.findOne({
      organizationId: orgId,
      tenantUserId: userId,
      status: "active",
    })
      .select("_id")
      .lean();
    if (!lease || Array.isArray(lease)) {
      throw httpError(404, "No active lease found", "NOT_FOUND");
    }

    const rows = await RentPayment.find({
      leaseId: lease._id,
      organizationId: orgId,
    })
      .sort({ paidAt: -1 })
      .lean();

    res.json({
      payments: rows.map((p) => serializeRentPayment(p as Record<string, unknown>)),
    });
  })
);

tenantRouter.get(
  "/balance",
  asyncHandler(async (req, res) => {
    const q = balanceQuerySchema.parse(req.query);
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const userId = requireObjectId(req.auth!.userId, "userId");

    const leaseDoc = await Lease.findOne({
      organizationId: orgId,
      tenantUserId: userId,
      status: "active",
    }).lean();

    if (!leaseDoc || Array.isArray(leaseDoc)) {
      throw httpError(404, "No active lease found", "NOT_FOUND");
    }

    const l = leaseDoc as Record<string, unknown>;
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

    const payments = await RentPayment.find({
      leaseId: l._id,
      organizationId: orgId,
    }).lean();
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

tenantRouter.get(
  "/maintenance-requests",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const userId = requireObjectId(req.auth!.userId, "userId");

    const rows = await MaintenanceRequest.find({
      organizationId: orgId,
      tenantUserId: userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      requests: rows.map((r) => serializeMaintenanceRequest(r as Record<string, unknown>)),
    });
  })
);

tenantRouter.post(
  "/maintenance-requests",
  asyncHandler(async (req, res) => {
    const body = createMaintenanceSchema.parse(req.body);
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const userId = requireObjectId(req.auth!.userId, "userId");

    const lease = await Lease.findOne({
      organizationId: orgId,
      tenantUserId: userId,
      status: "active",
    });

    if (!lease) {
      throw httpError(404, "No active lease found", "NOT_FOUND");
    }

    const doc = await MaintenanceRequest.create({
      organizationId: orgId,
      unitId: lease.unitId,
      leaseId: lease._id,
      tenantUserId: userId,
      title: body.title,
      description: body.description,
      priority: body.priority ?? "normal",
      status: "open",
      photoUrls: body.photoUrls ?? [],
    });

    res.status(201).json({
      request: serializeMaintenanceRequest(doc.toObject() as Record<string, unknown>),
    });
  })
);

tenantRouter.post(
  "/paystack/initialize",
  asyncHandler(async (req, res) => {
    const body = paystackInitSchema.parse(req.body);
    const env = loadEnv();
    if (!env.PAYSTACK_SECRET_KEY) {
      throw httpError(503, "Paystack is not configured", "PAYSTACK_DISABLED");
    }

    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const userId = requireObjectId(req.auth!.userId, "userId");

    const user = await User.findById(userId).lean();
    if (!user || Array.isArray(user)) {
      throw httpError(404, "User not found", "NOT_FOUND");
    }

    const lease = await Lease.findOne({
      organizationId: orgId,
      tenantUserId: userId,
      status: "active",
    });

    if (!lease) {
      throw httpError(404, "No active lease found", "NOT_FOUND");
    }

    const email = String((user as Record<string, unknown>).email ?? "").trim();
    if (!email) {
      throw httpError(400, "User email is required for Paystack", "EMAIL_REQUIRED");
    }

    const amountKobo = Math.round(body.amountNgn * 100);
    if (amountKobo < 100) {
      throw httpError(400, "Minimum payment is 1.00 in lease currency", "AMOUNT_TOO_SMALL");
    }

    const result = await paystackInitialize({
      email,
      amountKobo,
      metadata: {
        lease_id: lease._id.toString(),
        organization_id: orgId.toString(),
      },
    });

    res.status(201).json({
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
      accessCode: result.accessCode,
    });
  })
);

tenantRouter.get(
  "/documents",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const userId = requireObjectId(req.auth!.userId, "userId");

    const lease = await Lease.findOne({
      organizationId: orgId,
      tenantUserId: userId,
      status: "active",
    })
      .select("_id")
      .lean();
    if (!lease || Array.isArray(lease)) {
      throw httpError(404, "No active lease found", "NOT_FOUND");
    }

    const rows = await LeaseDocument.find({
      leaseId: lease._id,
      organizationId: orgId,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      documents: rows.map((d) => serializeLeaseDocument(d as Record<string, unknown>)),
    });
  })
);

tenantRouter.post(
  "/documents",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    if (!env.CLOUDINARY_CLOUD_NAME) {
      throw httpError(503, "Cloudinary is not configured", "CLOUDINARY_DISABLED");
    }

    if (!req.file?.buffer) {
      throw httpError(400, "Missing file field \"file\"", "FILE_REQUIRED");
    }

    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const userId = requireObjectId(req.auth!.userId, "userId");

    const lease = await Lease.findOne({
      organizationId: orgId,
      tenantUserId: userId,
      status: "active",
    });

    if (!lease) {
      throw httpError(404, "No active lease found", "NOT_FOUND");
    }

    const label =
      typeof req.body?.label === "string" ? req.body.label.slice(0, 200) : "";

    const { url, publicId } = await uploadLeaseDocument(
      req.file.buffer,
      req.file.originalname || "document"
    );

    const doc = await LeaseDocument.create({
      organizationId: orgId,
      leaseId: lease._id,
      uploadedBy: userId,
      label,
      cloudinaryUrl: url,
      cloudinaryPublicId: publicId,
      originalFileName: req.file.originalname ?? "",
    });

    res.status(201).json({
      document: serializeLeaseDocument(doc.toObject() as Record<string, unknown>),
    });
  })
);
