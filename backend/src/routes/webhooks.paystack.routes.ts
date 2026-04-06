import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { loadEnv } from "../config/env";
import { recordPaystackRentPaymentIfNew } from "../services/paystackRentPayment";

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

      const currency = (payload.data.currency ?? "NGN").toUpperCase();
      const paidAt = payload.data.paid_at
        ? new Date(payload.data.paid_at)
        : payload.data.paidAt
          ? new Date(payload.data.paidAt)
          : new Date();

      const meta = payload.data.metadata ?? {};

      const result = await recordPaystackRentPaymentIfNew({
        reference,
        amountKobo,
        currency,
        paidAt,
        metadata: meta,
      });

      if (result.kind === "duplicate") {
        res.json({ received: true, duplicate: true });
        return;
      }

      if (result.kind === "error") {
        // 200 so Paystack does not retry indefinitely on bad metadata
        res.status(200).json({ received: true, skipped: true, reason: result.code });
        return;
      }

      res.json({ received: true });
    } catch (e) {
      next(e);
    }
  }
);
