import "server-only"

import { db } from "@/lib/db"
import type { Notification } from "@/lib/generated/prisma/client"
import { sendMail } from "@/lib/mail"
import { isOnline, publish } from "@/lib/realtime/bus"
import type { NotificationDTO } from "@/lib/realtime/events"
import { appUrl } from "@/lib/request"

export type EmailPolicy = "always" | "if-offline" | "never"

type NotifyInput = {
  userIds: Iterable<string>
  type: string
  title: string
  body?: string | null
  /** In-app path, e.g. /leads/abc */
  link?: string | null
  email?: EmailPolicy
  /** Usually the actor: people aren't notified about their own actions. */
  excludeUserId?: string | null
}

export function toNotificationDTO(n: Notification): NotificationDTO {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }
}

/**
 * Stores an in-app notification, pushes it live, and emails it per the policy.
 * "if-offline" emails only people without the CRM open, so active users aren't
 * double-notified. Email sending never blocks or fails the caller.
 */
export async function notify({ userIds, type, title, body = null, link = null, email = "if-offline", excludeUserId }: NotifyInput) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== excludeUserId)
  if (ids.length === 0) return

  const recipients = await db.user.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    select: { id: true, email: true, role: true },
  })

  for (const recipient of recipients) {
    const notification = await db.notification.create({
      data: { userId: recipient.id, type, title: title.slice(0, 200), body: body?.slice(0, 500) ?? null, link },
    })
    publish([recipient.id], { type: "notification", notification: toNotificationDTO(notification) })

    const shouldEmail = email === "always" || (email === "if-offline" && !isOnline(recipient.id))
    if (shouldEmail) {
      void sendMail({
        to: recipient.email,
        subject: title,
        text: body ?? title,
        action: link ? { label: "Open in Klyron CRM", url: appUrl(link) } : undefined,
      }).then(async (sent) => {
        if (sent) await db.notification.update({ where: { id: notification.id }, data: { emailedAt: new Date() } })
      })
    }
  }
}

/** Latest notifications for the bell. */
export async function getNotificationsFor(userId: string) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 15 }),
    db.notification.count({ where: { userId, readAt: null } }),
  ])
  return { items: items.map(toNotificationDTO), unread }
}
