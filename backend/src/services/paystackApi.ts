import { loadEnv } from "../config/env";

const PAYSTACK_BASE = "https://api.paystack.co";

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
