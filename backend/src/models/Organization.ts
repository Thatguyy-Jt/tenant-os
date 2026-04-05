import mongoose, { Schema, type InferSchemaType } from "mongoose";

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    /** Default ISO 4217 code for new units / display (e.g. NGN). */
    defaultCurrency: {
      type: String,
      required: true,
      uppercase: true,
      maxlength: 3,
      default: "NGN",
    },
  },
  { timestamps: true }
);

organizationSchema.index({ name: 1 });

export type OrganizationDoc = InferSchemaType<typeof organizationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Organization =
  mongoose.models.Organization ?? mongoose.model("Organization", organizationSchema);
