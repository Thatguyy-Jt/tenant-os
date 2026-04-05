import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/api/client";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/api/staffApi";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export function NotificationsPage() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["staff", "notifications"],
    queryFn: () => listNotifications({ limit: 50 }),
  });

  const readOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", "notifications"] });
      void qc.invalidateQueries({ queryKey: ["staff", "notifications", "badge"] });
    },
  });

  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", "notifications"] });
      void qc.invalidateQueries({ queryKey: ["staff", "notifications", "badge"] });
    },
  });

  const items = q.data?.notifications ?? [];
  const unread = q.data?.unreadCount ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "You're all caught up."}
          </p>
        </div>
        {unread > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={readAll.isPending}
            onClick={() => readAll.mutate()}
          >
            {readAll.isPending ? "Marking…" : "Mark all read"}
          </Button>
        ) : null}
      </div>

      {q.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : q.isError ? (
        <p className="text-destructive">
          {q.error instanceof ApiError ? q.error.message : "Could not load notifications."}
        </p>
      ) : !items.length ? (
        <p className="text-muted-foreground">No notifications yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {items.map((n) => (
            <li
              key={n.id}
              className={`px-4 py-4 ${n.readAt ? "opacity-80" : "bg-primary/5"}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.readAt ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={readOne.isPending}
                    onClick={() => readOne.mutate(n.id)}
                  >
                    Mark read
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
