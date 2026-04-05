import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const UNIT_STATUSES = ["vacant", "occupied"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

const unitSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    label: { type: String, required: true, trim: true, maxlength: 100 },
    rentAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, maxlength: 3, default: "NGN" },
    status: {
      type: String,
      enum: UNIT_STATUSES,
      required: true,
      default: "vacant",
    },
  },
  { timestamps: true }
);

unitSchema.index({ organizationId: 1, propertyId: 1, label: 1 }, { unique: true });

export type UnitDoc = InferSchemaType<typeof unitSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Unit = mongoose.models.Unit ?? mongoose.model("Unit", unitSchema);
