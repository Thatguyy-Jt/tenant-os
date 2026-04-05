import { Router } from "express";
import { z } from "zod";
import { Notification } from "../models/Notification";
import { authenticate } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";
import { httpError } from "../middleware/errorHandler";
import { requireObjectId } from "../utils/objectId";
import { serializeNotification } from "../utils/serializers";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  unreadOnly: z.enum(["true", "false"]).optional(),
});

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listQuerySchema.parse(req.query);
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const userId = requireObjectId(req.auth!.userId, "userId");
    const limit = q.limit ?? 50;

    const filter: Record<string, unknown> = {
      userId,
      organizationId: orgId,
    };
    if (q.unreadOnly === "true") {
      filter.readAt = null;
    }

    const [rows, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({
        userId,
        organizationId: orgId,
        readAt: null,
      }),
    ]);

    res.json({
      notifications: rows.map((n) => serializeNotification(n as Record<string, unknown>)),
      unreadCount,
    });
  })
);

notificationsRouter.patch(
  "/:notificationId/read",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const userId = requireObjectId(req.auth!.userId, "userId");
    const notificationId = requireObjectId(req.params.notificationId, "notificationId");

    const updated = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        userId,
        organizationId: orgId,
      },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean();

    if (!updated) {
      throw httpError(404, "Notification not found", "NOT_FOUND");
    }

    res.json({
      notification: serializeNotification(updated as Record<string, unknown>),
    });
  })
);

notificationsRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    const orgId = requireObjectId(req.auth!.organizationId, "organizationId");
    const userId = requireObjectId(req.auth!.userId, "userId");

    const result = await Notification.updateMany(
      { userId, organizationId: orgId, readAt: null },
      { $set: { readAt: new Date() } }
    );

    res.json({ markedRead: result.modifiedCount });
  })
);
