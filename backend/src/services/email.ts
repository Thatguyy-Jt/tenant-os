import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { Resend } from "resend";
import { loadEnv } from "../config/env";
import type { Env } from "../config/env";

function createSmtpTransport(env: Env): Transporter {
  return nodemailer.createTransport({
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 25_000,
  });
}

/** True when outbound email is configured (Resend API or SMTP). */
export function isEmailConfigured(env: Env): boolean {
  return Boolean(env.RESEND_API_KEY || env.SMTP_HOST);
}

async function sendTransactionalEmail(
  env: Env,
  opts: { to: string; subject: string; text: string; html: string }
): Promise<void> {
  if (env.RESEND_API_KEY) {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  if (env.SMTP_HOST) {
    const transporter = createSmtpTransport(env);
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return;
  }

  throw new Error("No email provider configured (set RESEND_API_KEY or SMTP_HOST)");
}

export type TenantInviteEmailInput = {
  to: string;
  inviteUrl: string;
  organizationName: string;
  unitLabel: string;
};

/**
 * Sends tenant invite via Resend (preferred) or SMTP.
 * If neither is configured, logs the invite URL (local dev).
 */
export async function sendTenantInvitationEmail(input: TenantInviteEmailInput): Promise<void> {
  const env = loadEnv();
  const subject = `You're invited to TenantOS — ${input.organizationName}`;
  const text = [
    `Hello,`,
    ``,
    `You've been invited to join ${input.organizationName} as a tenant for unit ${input.unitLabel}.`,
    ``,
    `Open this link to create your password and activate your lease:`,
    input.inviteUrl,
    ``,
    `This link expires in ${env.INVITE_EXPIRES_DAYS} day(s).`,
    ``,
    `— TenantOS`,
  ].join("\n");

  const html = `<p>Hello,</p>
<p>You've been invited to join <strong>${escapeHtml(input.organizationName)}</strong> as a tenant for unit <strong>${escapeHtml(input.unitLabel)}</strong>.</p>
<p><a href="${escapeHtml(input.inviteUrl)}">Accept invitation and set your password</a></p>
<p>This link expires in ${env.INVITE_EXPIRES_DAYS} day(s).</p>
<p>— TenantOS</p>`;

  if (!isEmailConfigured(env)) {
    console.info(`[email] No RESEND_API_KEY or SMTP_HOST — not sending mail. Invite for ${input.to}:`);
    console.info(`  ${input.inviteUrl}`);
    return;
  }

  await sendTransactionalEmail(env, {
    to: input.to,
    subject,
    text,
    html,
  });
}

export type RentReminderEmailInput = {
  to: string;
  balance: number;
  currency: string;
};

/** Reminder when rent balance is outstanding (Bull cron). */
export async function sendRentReminderEmail(input: RentReminderEmailInput): Promise<void> {
  const env = loadEnv();
  const subject = `TenantOS — rent balance reminder (${input.currency})`;
  const text = [
    `Hello,`,
    ``,
    `This is a reminder that your current rent balance is ${input.balance.toFixed(2)} ${input.currency}.`,
    `Please log in to TenantOS to review your lease and make a payment.`,
    ``,
    `— TenantOS`,
  ].join("\n");

  const html = `<p>Hello,</p>
<p>This is a reminder that your current rent balance is <strong>${escapeHtml(input.balance.toFixed(2))} ${escapeHtml(input.currency)}</strong>.</p>
<p>Please log in to TenantOS to review your lease and make a payment.</p>
<p>— TenantOS</p>`;

  if (!isEmailConfigured(env)) {
    console.info(`[email] No RESEND_API_KEY or SMTP_HOST — rent reminder not sent to ${input.to}`);
    return;
  }

  await sendTransactionalEmail(env, {
    to: input.to,
    subject,
    text,
    html,
  });
}

export type EmailVerificationInput = {
  to: string;
  verifyUrl: string;
};

export async function sendEmailVerificationEmail(input: EmailVerificationInput): Promise<void> {
  const env = loadEnv();
  const subject = "Verify your TenantOS email";
  const text = [
    `Hello,`,
    ``,
    `Confirm your email address by opening this link:`,
    input.verifyUrl,
    ``,
    `If you did not create an account, you can ignore this message.`,
    ``,
    `— TenantOS`,
  ].join("\n");
  const html = `<p>Hello,</p>
<p>Confirm your email address by <a href="${escapeHtml(input.verifyUrl)}">clicking here</a>.</p>
<p>If you did not create an account, you can ignore this message.</p>
<p>— TenantOS</p>`;

  if (!isEmailConfigured(env)) {
    console.info(`[email] No RESEND_API_KEY or SMTP_HOST — verification link for ${input.to}:`);
    console.info(`  ${input.verifyUrl}`);
    return;
  }

  await sendTransactionalEmail(env, {
    to: input.to,
    subject,
    text,
    html,
  });
}

export type PasswordResetEmailInput = {
  to: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
  const env = loadEnv();
  const subject = "Reset your TenantOS password";
  const text = [
    `Hello,`,
    ``,
    `We received a request to reset your password. Open this link (it expires soon):`,
    input.resetUrl,
    ``,
    `If you did not request a reset, ignore this email.`,
    ``,
    `— TenantOS`,
  ].join("\n");
  const html = `<p>Hello,</p>
<p>We received a request to reset your password. <a href="${escapeHtml(input.resetUrl)}">Reset password</a></p>
<p>If you did not request a reset, ignore this email.</p>
<p>— TenantOS</p>`;

  if (!isEmailConfigured(env)) {
    console.info(`[email] No RESEND_API_KEY or SMTP_HOST — password reset link for ${input.to}:`);
    console.info(`  ${input.resetUrl}`);
    return;
  }

  await sendTransactionalEmail(env, {
    to: input.to,
    subject,
    text,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
