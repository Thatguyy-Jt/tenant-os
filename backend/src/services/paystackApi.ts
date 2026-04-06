import { loadEnv } from "../config/env";

const PAYSTACK_BASE = "https://api.paystack.co";

export type PaystackVerifiedTransaction = {
  reference: string;
  amountKobo: number;
  currency: string;
  metadata: Record<string, unknown>;
  paidAt: Date;
  gatewayStatus: string;
};

export type InitializeInput = {
  email: string;
  amountKobo: number;
  metadata: Record<string, string>;
  callbackUrl?: string;
};

export type InitializeResult = {
  authorizationUrl: string;
  reference: string;
  accessCode: string;
};

export async function paystackInitialize(input: InitializeInput): Promise<InitializeResult> {
  const env = loadEnv();
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }

  const body: Record<string, unknown> = {
    email: input.email,
    amount: input.amountKobo,
    currency: "NGN",
    metadata: input.metadata,
  };
  if (input.callbackUrl) {
    body.callback_url = input.callbackUrl;
  }

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    status: boolean;
    message: string;
    data?: { authorization_url: string; access_code: string; reference: string };
  };

  if (!res.ok || !json.status || !json.data) {
    throw new Error(json.message || `Paystack initialize failed (${res.status})`);
  }

  return {
    authorizationUrl: json.data.authorization_url,
    reference: json.data.reference,
    accessCode: json.data.access_code,
  };
}

/**
 * Confirms a transaction with Paystack (used when webhooks are unreachable, e.g. local dev).
 * https://paystack.com/docs/api/transaction/#verify
 */
export async function paystackVerifyTransaction(reference: string): Promise<PaystackVerifiedTransaction> {
  const env = loadEnv();
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }

  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      },
    }
  );

  const json = (await res.json()) as {
    status: boolean;
    message?: string;
    data?: {
      status: string;
      reference: string;
      amount: number;
      currency?: string;
      metadata?: Record<string, unknown>;
      paid_at?: string;
    };
  };

  if (!res.ok || !json.status || !json.data) {
    throw new Error(json.message || `Paystack verify failed (${res.status})`);
  }

  const d = json.data;
  const paidAt = d.paid_at ? new Date(d.paid_at) : new Date();

  return {
    reference: d.reference,
    amountKobo: d.amount,
    currency: (d.currency ?? "NGN").toUpperCase(),
    metadata: d.metadata ?? {},
    paidAt,
    gatewayStatus: d.status,
  };
}
