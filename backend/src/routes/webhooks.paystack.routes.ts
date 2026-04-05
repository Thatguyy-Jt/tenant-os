import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { loadEnv } from "../config/env";
import { Lease } from "../models/Lease";
import { RentPayment } from "../models/RentPayment";
import { notifyPaymentReceived } from "../services/inAppNotifications";

type PaystackWebhookBody = {
  event: string;
  data?: {
    reference?: string;
    amount?: number;
    currency?: string;
    metadata?: Record<string, unknown>;
    paid_at?: string;
    paidAt?: string;
  };
};

export const paystackWebhookRouter = Router();

paystackWebhookRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const env = loadEnv();
      if (!env.PAYSTACK_SECRET_KEY) {
        res.status(503).json({ received: false, error: "Paystack not configured" });
        return;
      }

      const raw = req.body as Buffer | undefined;
      if (!raw || !Buffer.isBuffer(raw)) {
        res.status(400).json({ received: false, error: "Expected raw body" });
        return;
      }

      const signature = req.headers["x-paystack-signature"];
      if (typeof signature !== "string") {
        res.status(401).json({ received: false, error: "Missing signature" });
        return;
      }

      const hash = crypto
        .createHmac("sha512", env.PAYSTACK_SECRET_KEY)
        .update(raw)
        .digest("hex");

      if (hash !== signature) {
        res.status(401).json({ received: false, error: "Invalid signature" });
        return;
      }

      const payload = JSON.parse(raw.toString("utf8")) as PaystackWebhookBody;

      if (payload.event !== "charge.success" || !payload.data?.reference) {
        res.json({ received: true });
        return;
      }

      const reference = payload.data.reference;
      const amountKobo = payload.data.amount;
      if (amountKobo == null || !Number.isFinite(amountKobo)) {
        res.json({ received: true });
        return;
      }

      const existing = await RentPayment.findOne({ paystackReference: reference });
      if (existing) {
        res.json({ received: true, duplicate: true });
        return;
      }

      const meta = payload.data.metadata ?? {};
      const leaseIdStr =
        typeof meta.lease_id === "string"
          ? meta.lease_id
          : typeof meta.leaseId === "string"
            ? meta.leaseId
            : null;
      const orgIdStr =
        typeof meta.organization_id === "string"
          ? meta.organization_id
          : typeof meta.organizationId === "string"
            ? meta.organizationId
            : null;

      if (!leaseIdStr || !orgIdStr) {
        res.status(400).json({ received: false, error: "Missing metadata" });
        return;
      }

      if (!mongoose.isValidObjectId(leaseIdStr) || !mongoose.isValidObjectId(orgIdStr)) {
        res.status(400).json({ received: false, error: "Invalid metadata ids" });
        return;
      }

      const lease = await Lease.findOne({
        _id: new mongoose.Types.ObjectId(leaseIdStr),
        organizationId: new mongoose.Types.ObjectId(orgIdStr),
      });

      if (!lease) {
        res.status(404).json({ received: false, error: "Lease not found" });
        return;
      }

      const currency = (payload.data.currency ?? "NGN").toUpperCase();
      if (currency !== lease.currency) {
        res.status(400).json({ received: false, error: "Currency mismatch" });
        return;
      }

      const amountNgn = Math.round(amountKobo) / 100;
      const paidAt = payload.data.paid_at
        ? new Date(payload.data.paid_at)
        : payload.data.paidAt
          ? new Date(payload.data.paidAt)
          : new Date();

      await RentPayment.create({
        organizationId: lease.organizationId,
        leaseId: lease._id,
        amount: amountNgn,
        currency: lease.currency,
        paidAt,
        method: "paystack",
        recordedBy: null,
        notes: "Paystack",
        paystackReference: reference,
      });

      await notifyPaymentReceived({
        tenantUserId: lease.tenantUserId as mongoose.Types.ObjectId,
        organizationId: lease.organizationId as mongoose.Types.ObjectId,
        amount: amountNgn,
        currency: lease.currency,
        leaseId: lease._id as mongoose.Types.ObjectId,
      });

      res.json({ received: true });
    } catch (e) {
      next(e);
    }
  }
);
