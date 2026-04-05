import Queue from "bull";
import { loadEnv } from "../config/env";
import { Lease } from "../models/Lease";
import { RentPayment } from "../models/RentPayment";
import { User } from "../models/User";
import { sendRentReminderEmail } from "../services/email";
import { computeBalance, computeExpectedRentThrough, sumPayments } from "../services/rent";
import { runLeaseExpiryNotifications } from "../services/inAppNotifications";

let queue: InstanceType<typeof Queue> | null = null;

export async function startReminderWorker(): Promise<void> {
  const env = loadEnv();
  if (!env.REDIS_URL) {
    console.info("[reminders] REDIS_URL not set — scheduled rent reminders disabled");
    return;
  }

  queue = new Queue("rent-reminders", env.REDIS_URL);

  try {
    await queue.add(
      {},
      {
        repeat: { cron: "0 9 * * *" },
        jobId: "daily-rent-reminders",
      }
    );
  } catch (e) {
    console.warn("[reminders] could not register repeatable job (may already exist)", e);
  }

  queue.process(async () => {
    const leases = await Lease.find({ status: "active" }).lean();
    const asOf = new Date();

    for (const row of leases) {
      const l = row as Record<string, unknown>;
      const payments = await RentPayment.find({ leaseId: l._id }).lean();
      const totalPaid = sumPayments(
        payments.map((p) => ({
          amount: Number((p as Record<string, unknown>).amount),
        }))
      );
      const expected = computeExpectedRentThrough(
        {
          startDate: l.startDate as Date,
          endDate: (l.endDate as Date | null) ?? null,
          rentAmount: Number(l.rentAmount),
          billingFrequency: l.billingFrequency as "monthly" | "yearly",
        },
        asOf
      );
      const balance = computeBalance(expected, totalPaid);
      if (balance <= 0) continue;

      const tenant = await User.findById(l.tenantUserId).lean();
      if (!tenant || Array.isArray(tenant)) continue;
      const email = (tenant as { email?: string }).email;
      if (!email) continue;

      await sendRentReminderEmail({
        to: email,
        balance,
        currency: String(l.currency ?? "NGN"),
      });
    }

    try {
      await runLeaseExpiryNotifications();
    } catch (e) {
      console.error("[reminders] lease expiry notifications failed", e);
    }
  });
}

export async function closeReminderQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
