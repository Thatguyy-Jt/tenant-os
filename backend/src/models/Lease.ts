import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { BILLING_FREQUENCIES } from "./Invitation";

export const LEASE_STATUSES = ["active", "ended"] as const;
export type LeaseStatus = (typeof LEASE_STATUSES)[number];

const leaseSchema = new Schema(
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
    tenantUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    invitationId: {
      type: Schema.Types.ObjectId,
      ref: "Invitation",
      default: null,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    rentAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    billingFrequency: {
      type: String,
      enum: BILLING_FREQUENCIES,
      required: true,
    },
    status: {
      type: String,
      enum: LEASE_STATUSES,
      required: true,
      default: "active",
    },
  },
  { timestamps: true }
);

leaseSchema.index({ organizationId: 1, tenantUserId: 1 });
leaseSchema.index({ unitId: 1, status: 1 });

export type LeaseDoc = InferSchemaType<typeof leaseSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Lease = mongoose.models.Lease ?? mongoose.model("Lease", leaseSchema);
