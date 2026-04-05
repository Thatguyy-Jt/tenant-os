import mongoose, { Schema, type InferSchemaType } from "mongoose";

const leaseDocumentSchema = new Schema(
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
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    label: { type: String, trim: true, maxlength: 200, default: "" },
    cloudinaryUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    originalFileName: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true }
);

leaseDocumentSchema.index({ leaseId: 1, createdAt: -1 });

export type LeaseDocumentDoc = InferSchemaType<typeof leaseDocumentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const LeaseDocument =
  mongoose.models.LeaseDocument ?? mongoose.model("LeaseDocument", leaseDocumentSchema);
