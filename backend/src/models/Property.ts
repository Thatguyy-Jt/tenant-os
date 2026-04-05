import mongoose, { Schema, type InferSchemaType } from "mongoose";

const propertySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, trim: true, maxlength: 200 },
    addressLine1: { type: String, required: true, trim: true, maxlength: 300 },
    addressLine2: { type: String, trim: true, maxlength: 300 },
    city: { type: String, required: true, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120 },
    country: { type: String, required: true, trim: true, maxlength: 120 },
    postalCode: { type: String, trim: true, maxlength: 32 },
    propertyPhotos: {
      type: [
        {
          url: { type: String, required: true },
          cloudinaryPublicId: { type: String, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

propertySchema.index({ organizationId: 1, createdAt: -1 });

export type PropertyDoc = InferSchemaType<typeof propertySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Property =
  mongoose.models.Property ?? mongoose.model("Property", propertySchema);
