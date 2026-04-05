import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const USER_ROLES = ["landlord", "agent", "tenant"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    /** If explicitly false, login is blocked until verified (omit/true = treated as verified). */
    emailVerified: { type: Boolean },
    emailVerificationTokenHash: { type: String, select: false, default: null },
    emailVerificationExpires: { type: Date, default: null },
    passwordResetTokenHash: { type: String, select: false, default: null },
    passwordResetExpires: { type: Date, default: null },
    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    /** Properties an agent may access (empty = none). Landlords/tenants ignore this field. */
    assignedPropertyIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Property" }],
      default: [],
    },
  },
  { timestamps: true }
);

userSchema.index({ organizationId: 1, email: 1 });

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const User = mongoose.models.User ?? mongoose.model("User", userSchema);
