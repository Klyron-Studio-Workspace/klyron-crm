"use server"

import { requireUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { publish } from "@/lib/realtime/bus"

export async function markNotificationRead(notificationId: string) {
  const user = await requireUser({ allowPasswordChange: true })
  await db.notification.updateMany({ where: { id: notificationId, userId: user.id, readAt: null }, data: { readAt: new Date() } })
  publish([user.id], { type: "notifications.read" })
}

export async function markAllNotificationsRead() {
  const user = await requireUser({ allowPasswordChange: true })
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } })
  publish([user.id], { type: "notifications.read" })
}
