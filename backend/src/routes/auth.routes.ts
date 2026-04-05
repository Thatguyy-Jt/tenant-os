import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type mongoose from "mongoose";
import { Organization } from "../models/Organization";
import { User, USER_ROLES, type UserRole } from "../models/User";
import { loadEnv } from "../config/env";
import { asyncHandler } from "../utils/asyncHandler";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { httpError } from "../middleware/errorHandler";
import { requireObjectId } from "../utils/objectId";
import {
  buildAuthResponse,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
} from "../services/authSession";
import { generateOpaqueToken, hashOpaqueToken } from "../utils/secureToken";
import { sendEmailVerificationEmail, sendPasswordResetEmail } from "../services/email";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  organizationName: z.string().min(1).max(200),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

/** Invite / create user under existing org (landlord-only). */
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(USER_ROLES),
  assignedPropertyIds: z.array(z.string()).optional(),
});

const skipRateLimitInTest = (): boolean => process.env.NODE_ENV === "test";

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts, try again later." },
  skip: skipRateLimitInTest,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, try again later." },
  skip: skipRateLimitInTest,
});

const sensitiveAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, try again later." },
  skip: skipRateLimitInTest,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimitInTest,
});

export const authRouter = Router();

authRouter.post(
  "/register",
  registerLimiter,
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const env = loadEnv();
    const isTest = env.NODE_ENV === "test";
    /** Tests always use immediate signup so integration tests stay stable. */
    const useVerificationFlow = env.REQUIRE_EMAIL_VERIFICATION && !isTest;

    const existing = await User.findOne({ email: body.email });
    if (existing) {
      throw httpError(409, "Email already registered", "EMAIL_IN_USE");
    }

    const org = await Organization.create({ name: body.organizationName });
    const passwordHash = await bcrypt.hash(body.password, 12);

    let emailVerificationTokenHash: string | null = null;
    let emailVerificationExpires: Date | null = null;
    let plainVerificationToken: string | undefined;

    if (useVerificationFlow) {
      plainVerificationToken = generateOpaqueToken(32);
      emailVerificationTokenHash = hashOpaqueToken(plainVerificationToken);
      emailVerificationExpires = new Date(
        Date.now() + env.EMAIL_VERIFICATION_EXPIRES_HOURS * 3600 * 1000
      );
    }

    const user = await User.create({
      email: body.email,
      passwordHash,
      role: "landlord",
      organizationId: org._id,
      emailVerified: useVerificationFlow ? false : true,
      emailVerificationTokenHash,
      emailVerificationExpires,
    });

    if (useVerificationFlow && plainVerificationToken) {
      const base = env.APP_PUBLIC_URL.replace(/\/$/, "");
      const verifyUrl = `${base}/verify-email?token=${encodeURIComponent(plainVerificationToken)}`;
      await sendEmailVerificationEmail({ to: user.email, verifyUrl });
      res.status(201).json({
        message:
          "Registration successful. Check your email to verify your account before signing in.",
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          organizationId: org._id.toString(),
          emailVerified: false,
        },
        organization: { id: org._id.toString(), name: org.name },
      });
      return;
    }

    const auth = await buildAuthResponse(user);
    res.status(201).json({
      ...auth,
      organization: { id: org._id.toString(), name: org.name },
    });
  })
);

authRouter.post(
  "/verify-email",
  sensitiveAuthLimiter,
  asyncHandler(async (req, res) => {
    const body = verifyEmailSchema.parse(req.body);
    const env = loadEnv();
    const digest = hashOpaqueToken(body.token);

    const user = await User.findOne({
      emailVerificationTokenHash: digest,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      throw httpError(400, "Invalid or expired verification link", "INVALID_TOKEN");
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpires: null,
        },
      }
    );

    const fresh = await User.findById(user._id);
    if (!fresh) {
      throw httpError(500, "User not found after verification", "INTERNAL");
    }

    const auth = await buildAuthResponse(fresh);
    res.status(200).json(auth);
  })
);

authRouter.post(
  "/forgot-password",
  sensitiveAuthLimiter,
  asyncHandler(async (req, res) => {
    const body = forgotPasswordSchema.parse(req.body);
    const env = loadEnv();
    const email = body.email.toLowerCase().trim();

    const user = await User.findOne({ email });
    if (user) {
      const raw = generateOpaqueToken(32);
      const tokenHash = hashOpaqueToken(raw);
      const passwordResetExpires = new Date(
        Date.now() + env.PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000
      );
      await User.updateOne(
        { _id: user._id },
        { $set: { passwordResetTokenHash: tokenHash, passwordResetExpires } }
      );
      const base = env.APP_PUBLIC_URL.replace(/\/$/, "");
      const resetUrl = `${base}/reset-password?token=${encodeURIComponent(raw)}`;
      await sendPasswordResetEmail({ to: user.email, resetUrl });
    }

    res.json({
      message: "If an account exists for this email, you will receive reset instructions.",
    });
  })
);

authRouter.post(
  "/reset-password",
  sensitiveAuthLimiter,
  asyncHandler(async (req, res) => {
    const body = resetPasswordSchema.parse(req.body);
    const digest = hashOpaqueToken(body.token);

    const user = await User.findOne({
      passwordResetTokenHash: digest,
      passwordResetExpires: { $gt: new Date() },
    }).select("+passwordHash");

    if (!user) {
      throw httpError(400, "Invalid or expired reset link", "INVALID_TOKEN");
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash,
          passwordResetTokenHash: null,
          passwordResetExpires: null,
        },
      }
    );

    await revokeAllRefreshTokensForUser(user._id);

    res.json({ message: "Password updated. Sign in with your new password." });
  })
);

authRouter.post(
  "/refresh",
  refreshLimiter,
  asyncHandler(async (req, res) => {
    const body = refreshSchema.parse(req.body);
    const userId = await consumeRefreshToken(body.refreshToken);
    if (!userId) {
      throw httpError(401, "Invalid or expired refresh session", "INVALID_REFRESH");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw httpError(401, "User not found", "INVALID_REFRESH");
    }
    const auth = await buildAuthResponse(user);
    res.json(auth);
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const body = logoutSchema.parse(req.body ?? {});
    if (body.refreshToken) {
      await revokeRefreshToken(body.refreshToken);
    }
    res.status(204).send();
  })
);

authRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const env = loadEnv();
    const body = loginSchema.parse(req.body);

    const user = await User.findOne({ email: body.email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw httpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    if (env.REQUIRE_EMAIL_VERIFICATION && user.emailVerified === false) {
      throw httpError(403, "Verify your email before signing in", "EMAIL_NOT_VERIFIED");
    }

    const auth = await buildAuthResponse(user);
    res.json(auth);
  })
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const user = await User.findById(auth.userId).lean();
    if (!user || Array.isArray(user)) {
      throw httpError(404, "User not found", "NOT_FOUND");
    }
    type LeanUser = {
      _id: mongoose.Types.ObjectId;
      email: string;
      role: string;
      organizationId: mongoose.Types.ObjectId;
      emailVerified?: boolean;
    };
    const u = user as unknown as LeanUser;
    const orgDoc = await Organization.findById(auth.organizationId).lean();
    const org =
      orgDoc && !Array.isArray(orgDoc)
        ? (orgDoc as unknown as {
            _id: mongoose.Types.ObjectId;
            name: string;
            defaultCurrency?: string;
          })
        : null;
    res.json({
      user: {
        id: u._id.toString(),
        email: u.email,
        role: u.role,
        organizationId: u.organizationId.toString(),
        emailVerified: u.emailVerified !== false,
      },
      organization: org
        ? {
            id: org._id.toString(),
            name: org.name,
            defaultCurrency: (org.defaultCurrency ?? "NGN").toUpperCase(),
          }
        : null,
    });
  })
);

authRouter.post(
  "/users",
  authenticate,
  requireRole("landlord"),
  asyncHandler(async (req, res) => {
    const body = createUserSchema.parse(req.body);
    const auth = req.auth!;

    const existing = await User.findOne({ email: body.email });
    if (existing) {
      throw httpError(409, "Email already registered", "EMAIL_IN_USE");
    }

    const assignedPropertyIds =
      body.role === "agent" && body.assignedPropertyIds?.length
        ? body.assignedPropertyIds.map((id) => requireObjectId(id, "assignedPropertyId"))
        : [];

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await User.create({
      email: body.email,
      passwordHash,
      role: body.role,
      organizationId: auth.organizationId,
      emailVerified: true,
      assignedPropertyIds: body.role === "agent" ? assignedPropertyIds : [],
    });

    res.status(201).json({
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        organizationId: user.organizationId.toString(),
        emailVerified: true,
        assignedPropertyIds:
          user.assignedPropertyIds?.map((id: mongoose.Types.ObjectId) => id.toString()) ?? [],
      },
    });
  })
);
