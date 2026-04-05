import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const BILLING_FREQUENCIES = ["monthly", "yearly"] as const;
export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];

const invitationSchema = new Schema(
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
    email: { type: String, required: true, lowercase: true, trim: true },
    tokenDigest: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    consumedAt: { type: Date, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    rentAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    billingFrequency: {
      type: String,
      enum: BILLING_FREQUENCIES,
      required: true,
    },
  },
  { timestamps: true }
);

invitationSchema.index({ organizationId: 1, email: 1 });
invitationSchema.index({ unitId: 1, consumedAt: 1, expiresAt: 1 });

export type InvitationDoc = InferSchemaType<typeof invitationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Invitation =
  mongoose.models.Invitation ?? mongoose.model("Invitation", invitationSchema);
