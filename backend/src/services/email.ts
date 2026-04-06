import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
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

export type TenantInviteEmailInput = {
  to: string;
  inviteUrl: string;
  organizationName: string;
  unitLabel: string;
};

/**
 * Sends the tenant invite email via Nodemailer when `SMTP_HOST` is set.
 * If `SMTP_HOST` is omitted, logs the invite URL (useful for local development).
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

  if (!env.SMTP_HOST) {
    console.info(`[email] SMTP_HOST not set — not sending mail. Invite for ${input.to}:`);
    console.info(`  ${input.inviteUrl}`);
    return;
  }

  const transporter = createSmtpTransport(env);

  await transporter.sendMail({
    from: env.EMAIL_FROM,
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

  if (!env.SMTP_HOST) {
    console.info(`[email] SMTP_HOST not set — rent reminder not sent to ${input.to}`);
    return;
  }

  const transporter = createSmtpTransport(env);

  await transporter.sendMail({
    from: env.EMAIL_FROM,
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

  if (!env.SMTP_HOST) {
    console.info(`[email] SMTP_HOST not set — verification link for ${input.to}:`);
    console.info(`  ${input.verifyUrl}`);
    return;
  }

  const transporter = createSmtpTransport(env);

  await transporter.sendMail({
    from: env.EMAIL_FROM,
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

  if (!env.SMTP_HOST) {
    console.info(`[email] SMTP_HOST not set — password reset link for ${input.to}:`);
    console.info(`  ${input.resetUrl}`);
    return;
  }

  const transporter = createSmtpTransport(env);

  await transporter.sendMail({
    from: env.EMAIL_FROM,
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
