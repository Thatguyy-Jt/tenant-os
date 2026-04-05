import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const MAINTENANCE_STATUSES = ["open", "in_progress", "resolved", "cancelled"] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_PRIORITIES = ["low", "normal", "high"] as const;
export type MaintenancePriority = (typeof MAINTENANCE_PRIORITIES)[number];

const maintenanceRequestSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    unitId: {
      type: Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
      index: true,
    },
    leaseId: {
      type: Schema.Types.ObjectId,
      ref: "Lease",
      required: true,
      index: true,
    },
    tenantUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 8000 },
    priority: {
      type: String,
      enum: MAINTENANCE_PRIORITIES,
      default: "normal",
    },
    status: {
      type: String,
      enum: MAINTENANCE_STATUSES,
      required: true,
      default: "open",
    },
    photoUrls: {
      type: [String],
      default: [],
    },
    assignedToUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

maintenanceRequestSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
maintenanceRequestSchema.index({ tenantUserId: 1, organizationId: 1, createdAt: -1 });

export type MaintenanceRequestDoc = InferSchemaType<typeof maintenanceRequestSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const MaintenanceRequest =
  mongoose.models.MaintenanceRequest ??
  mongoose.model("MaintenanceRequest", maintenanceRequestSchema);
