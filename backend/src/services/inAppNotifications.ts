import mongoose from "mongoose";
import { User } from "../models/User";
import { Unit } from "../models/Unit";
import { Lease } from "../models/Lease";
import { Notification, type NotificationType } from "../models/Notification";

export async function createNotification(input: {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await Notification.create({
    userId: input.userId,
    organizationId: input.organizationId,
    type: input.type,
    title: input.title,
    body: input.body,
    metadata: input.metadata ?? {},
  });
}

export async function createNotificationsForUsers(
  userIds: mongoose.Types.ObjectId[],
  organizationId: mongoose.Types.ObjectId,
  type: NotificationType,
  title: string,
  body: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (userIds.length === 0) return;
  const base = { organizationId, type, title, body, metadata: metadata ?? {} };
  await Notification.insertMany(
    userIds.map((userId) => ({
      ...base,
      userId,
    }))
  );
}

/** After a successful Paystack-settled rent payment. */
export async function notifyPaymentReceived(input: {
  tenantUserId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  leaseId: mongoose.Types.ObjectId;
}): Promise<void> {
  await createNotification({
    userId: input.tenantUserId,
    organizationId: input.organizationId,
    type: "payment_received",
    title: "Rent payment received",
    body: `A payment of ${input.amount.toFixed(2)} ${input.currency} was recorded for your lease.`,
    metadata: { leaseId: input.leaseId.toString() },
  });
}

/** Staff updated maintenance request status. */
export async function notifyMaintenanceUpdated(input: {
  tenantUserId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  requestId: mongoose.Types.ObjectId;
  newStatus: string;
  title: string;
}): Promise<void> {
  await createNotification({
    userId: input.tenantUserId,
    organizationId: input.organizationId,
    type: "maintenance_updated",
    title: "Maintenance request updated",
    body: `Your request "${input.title}" is now ${input.newStatus.replace(/_/g, " ")}.`,
    metadata: { maintenanceRequestId: input.requestId.toString() },
  });
}

const LEASE_EXPIRY_WINDOW_DAYS = 30;
const LEASE_EXPIRY_NOTIFY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Daily job: leases ending within 30 days — tenant + staff (deduped per lease per week). */
export async function runLeaseExpiryNotifications(): Promise<void> {
  const now = new Date();
  const horizon = new Date(now.getTime() + LEASE_EXPIRY_WINDOW_DAYS * 86400000);
  const leases = await Lease.find({
    status: "active",
    endDate: { $ne: null, $gte: now, $lte: horizon },
  }).lean();

  const cooldownCutoff = new Date(Date.now() - LEASE_EXPIRY_NOTIFY_COOLDOWN_MS);

  for (const row of leases) {
    const l = row as Record<string, unknown>;
    const leaseId = l._id as mongoose.Types.ObjectId;
    const orgId = l.organizationId as mongoose.Types.ObjectId;
    const tenantUserId = l.tenantUserId as mongoose.Types.ObjectId;
    const endDate = l.endDate as Date;

    const recent = await Notification.findOne({
      type: "lease_expiring",
      "metadata.leaseId": leaseId.toString(),
      createdAt: { $gte: cooldownCutoff },
    })
      .select("_id")
      .lean();
    if (recent) continue;

    const daysLeft = Math.max(
      0,
      Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    );
    const title = "Lease ending soon";
    const body = `Your lease ends on ${endDate.toISOString().slice(0, 10)} (${daysLeft} day(s) from now). Contact your landlord if you plan to renew.`;

    const meta = { leaseId: leaseId.toString(), endDate: endDate.toISOString() };

    await createNotification({
      userId: tenantUserId,
      organizationId: orgId,
      type: "lease_expiring",
      title,
      body,
      metadata: meta,
    });

    const landlords = await User.find({
      organizationId: orgId,
      role: "landlord",
    })
      .select("_id")
      .lean();
    const landlordIds = landlords.map((u) => u._id as mongoose.Types.ObjectId);

    const unit = await Unit.findById(l.unitId as mongoose.Types.ObjectId).select("propertyId").lean();
    const propertyId = unit
      ? (unit as unknown as { propertyId: mongoose.Types.ObjectId }).propertyId
      : null;
    const agents = propertyId
      ? await User.find({
          organizationId: orgId,
          role: "agent",
          assignedPropertyIds: propertyId,
        })
          .select("_id")
          .lean()
      : [];
    const agentIds = agents.map((a) => a._id as mongoose.Types.ObjectId);

    const staffBody = `A lease ends on ${endDate.toISOString().slice(0, 10)} (${daysLeft} day(s) remaining).`;
    await createNotificationsForUsers(landlordIds, orgId, "lease_expiring", title, staffBody, meta);
    await createNotificationsForUsers(agentIds, orgId, "lease_expiring", title, staffBody, meta);
  }
}
