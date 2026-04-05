import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const PAYMENT_METHODS = ["manual", "paystack"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const rentPaymentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    leaseId: {
      type: Schema.Types.ObjectId,
      ref: "Lease",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    paidAt: { type: Date, required: true, index: true },
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
      default: "manual",
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    notes: { type: String, maxlength: 2000, default: "" },
    /** Paystack transaction reference — unique for webhook idempotency */
    paystackReference: { type: String, sparse: true, unique: true },
  },
  { timestamps: true }
);

rentPaymentSchema.index({ organizationId: 1, paidAt: -1 });
rentPaymentSchema.index({ leaseId: 1, paidAt: -1 });

export type RentPaymentDoc = InferSchemaType<typeof rentPaymentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const RentPayment =
  mongoose.models.RentPayment ?? mongoose.model("RentPayment", rentPaymentSchema);
