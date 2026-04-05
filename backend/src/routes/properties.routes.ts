import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import mongoose from "mongoose";
import { Property } from "../models/Property";
import { Unit } from "../models/Unit";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { httpError } from "../middleware/errorHandler";
import { requireObjectId } from "../utils/objectId";
import { loadEnv } from "../config/env";
import {
  destroyCloudinaryAsset,
  MAX_PROPERTY_IMAGE_BYTES,
  uploadPropertyPhoto,
} from "../services/cloudinaryUpload";
import { isMongoDuplicateKeyError, serializeProperty, serializeUnit } from "../utils/serializers";
import {
  assertPropertyInStaffScope,
  getStaffPropertyScope,
  propertyQueryForStaff,
} from "../services/propertyAccess";

const createPropertySchema = z.object({
  name: z.string().max(200).optional(),
  addressLine1: z.string().min(1).max(300),
  addressLine2: z.string().max(300).optional(),
  city: z.string().min(1).max(120),
  state: z.string().max(120).optional(),
  country: z.string().min(1).max(120),
  postalCode: z.string().max(32).optional(),
});

const patchPropertySchema = createPropertySchema.partial();

const createUnitSchema = z.object({
  label: z.string().min(1).max(100),
  rentAmount: z.number().nonnegative(),
  currency: z.string().length(3).optional(),
  status: z.enum(["vacant", "occupied"]).optional(),
});

const deletePropertyPhotoSchema = z.object({
  publicId: z.string().min(1).max(500),
});

const MAX_PROPERTY_PHOTOS = 20;

const propertyPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROPERTY_IMAGE_BYTES },
});

export const propertiesRouter = Router();

propertiesRouter.use(authenticate);

propertiesRouter.get(
  "/",
  requireRole("landlord", "agent"),
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const scope = await getStaffPropertyScope(req.auth!.userId, req.auth!.role);
    const match = propertyQueryForStaff(orgId, scope);
    const list = await Property.find(match).sort({ createdAt: -1 }).lean();
    res.json({
      properties: list.map((p) => serializeProperty(p as Record<string, unknown>)),
    });
  })
);

propertiesRouter.post(
  "/",
  requireRole("landlord"),
  asyncHandler(async (req, res) => {
    const body = createPropertySchema.parse(req.body);
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const doc = await Property.create({
      organizationId: orgId,
      name: body.name,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      state: body.state,
      country: body.country,
      postalCode: body.postalCode,
    });
    res.status(201).json({
      property: serializeProperty(doc.toObject() as Record<string, unknown>),
    });
  })
);

propertiesRouter.post(
  "/:propertyId/photos",
  requireRole("landlord"),
  propertyPhotoUpload.single("file"),
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    if (!env.CLOUDINARY_CLOUD_NAME) {
      throw httpError(503, "Cloudinary is not configured", "CLOUDINARY_DISABLED");
    }
    if (!req.file?.buffer) {
      throw httpError(400, 'Missing file field "file"', "FILE_REQUIRED");
    }
    if (!req.file.mimetype.startsWith("image/")) {
      throw httpError(400, "Only image files are allowed", "INVALID_FILE_TYPE");
    }
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const propertyId = requireObjectId(req.params.propertyId, "propertyId");
    const property = await Property.findOne({ _id: propertyId, organizationId: orgId });
    if (!property) {
      throw httpError(404, "Property not found", "NOT_FOUND");
    }
    const existing =
      (property.propertyPhotos as { url: string; cloudinaryPublicId: string }[] | undefined) ?? [];
    if (existing.length >= MAX_PROPERTY_PHOTOS) {
      throw httpError(400, "Maximum 20 photos per property", "PHOTO_LIMIT");
    }
    const { url, publicId } = await uploadPropertyPhoto(
      req.file.buffer,
      req.file.originalname || "photo"
    );
    property.propertyPhotos = [...existing, { url, cloudinaryPublicId: publicId }];
    await property.save();
    res.status(201).json({
      property: serializeProperty(property.toObject() as Record<string, unknown>),
    });
  })
);

propertiesRouter.delete(
  "/:propertyId/photos",
  requireRole("landlord"),
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    if (!env.CLOUDINARY_CLOUD_NAME) {
      throw httpError(503, "Cloudinary is not configured", "CLOUDINARY_DISABLED");
    }
    const body = deletePropertyPhotoSchema.parse(req.body);
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const propertyId = requireObjectId(req.params.propertyId, "propertyId");
    const property = await Property.findOne({ _id: propertyId, organizationId: orgId });
    if (!property) {
      throw httpError(404, "Property not found", "NOT_FOUND");
    }
    const existing =
      (property.propertyPhotos as { url: string; cloudinaryPublicId: string }[] | undefined) ?? [];
    const idx = existing.findIndex((p) => p.cloudinaryPublicId === body.publicId);
    if (idx === -1) {
      throw httpError(404, "Photo not found on this property", "NOT_FOUND");
    }
    try {
      await destroyCloudinaryAsset(body.publicId);
    } catch {
      /* remove DB row even if asset already gone */
    }
    property.propertyPhotos = existing.filter((_, i) => i !== idx);
    await property.save();
    res.json({
      property: serializeProperty(property.toObject() as Record<string, unknown>),
    });
  })
);

const unitsNested = Router({ mergeParams: true });

unitsNested.get(
  "/",
  requireRole("landlord", "agent"),
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const propertyId = requireObjectId(req.params.propertyId, "propertyId");
    const scope = await getStaffPropertyScope(req.auth!.userId, req.auth!.role);
    const property = await Property.findOne({ _id: propertyId, organizationId: orgId }).lean();
    if (!property) {
      throw httpError(404, "Property not found", "NOT_FOUND");
    }
    await assertPropertyInStaffScope(orgId, propertyId, scope);
    const units = await Unit.find({ organizationId: orgId, propertyId }).sort({ label: 1 }).lean();
    res.json({
      units: units.map((u) => serializeUnit(u as Record<string, unknown>)),
    });
  })
);

unitsNested.post(
  "/",
  requireRole("landlord"),
  asyncHandler(async (req, res) => {
    const body = createUnitSchema.parse(req.body);
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const propertyId = requireObjectId(req.params.propertyId, "propertyId");
    const property = await Property.findOne({ _id: propertyId, organizationId: orgId });
    if (!property) {
      throw httpError(404, "Property not found", "NOT_FOUND");
    }
    try {
      const unit = await Unit.create({
        organizationId: orgId,
        propertyId,
        label: body.label,
        rentAmount: body.rentAmount,
        currency: (body.currency ?? "NGN").toUpperCase(),
        status: body.status ?? "vacant",
      });
      res.status(201).json({
        unit: serializeUnit(unit.toObject() as Record<string, unknown>),
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

propertiesRouter.use("/:propertyId/units", unitsNested);

propertiesRouter.get(
  "/:propertyId",
  requireRole("landlord", "agent"),
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const propertyId = requireObjectId(req.params.propertyId, "propertyId");
    const scope = await getStaffPropertyScope(req.auth!.userId, req.auth!.role);
    const property = await Property.findOne({ _id: propertyId, organizationId: orgId }).lean();
    if (!property) {
      throw httpError(404, "Property not found", "NOT_FOUND");
    }
    await assertPropertyInStaffScope(orgId, propertyId, scope);
    res.json({
      property: serializeProperty(property as Record<string, unknown>),
    });
  })
);

propertiesRouter.patch(
  "/:propertyId",
  requireRole("landlord"),
  asyncHandler(async (req, res) => {
    const body = patchPropertySchema.parse(req.body);
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const propertyId = requireObjectId(req.params.propertyId, "propertyId");
    const property = await Property.findOneAndUpdate(
      { _id: propertyId, organizationId: orgId },
      { $set: body },
      { new: true }
    ).lean();
    if (!property) {
      throw httpError(404, "Property not found", "NOT_FOUND");
    }
    res.json({
      property: serializeProperty(property as Record<string, unknown>),
    });
  })
);

propertiesRouter.delete(
  "/:propertyId",
  requireRole("landlord"),
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const propertyId = requireObjectId(req.params.propertyId, "propertyId");
    const propLean = await Property.findOne({ _id: propertyId, organizationId: orgId }).lean();
    if (!propLean) {
      throw httpError(404, "Property not found", "NOT_FOUND");
    }
    const env = loadEnv();
    if (env.CLOUDINARY_CLOUD_NAME) {
      const photos =
        (propLean as { propertyPhotos?: { cloudinaryPublicId: string }[] }).propertyPhotos ?? [];
      for (const ph of photos) {
        try {
          await destroyCloudinaryAsset(ph.cloudinaryPublicId);
        } catch {
          /* ignore */
        }
      }
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const prop = await Property.findOne({ _id: propertyId, organizationId: orgId }).session(
          session
        );
        if (!prop) {
          throw httpError(404, "Property not found", "NOT_FOUND");
        }
        await Unit.deleteMany({ organizationId: orgId, propertyId }).session(session);
        await Property.deleteOne({ _id: propertyId, organizationId: orgId }).session(session);
      });
    } finally {
      await session.endSession();
    }
    res.status(204).send();
  })
);
