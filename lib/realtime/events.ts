// Client-safe event shapes sent over /api/events (Server-Sent Events).
import type { MessageDTO } from "@/lib/chat/types"

export type NotificationDTO = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

export type RealtimeEvent =
  | { type: "message"; channelId: string; message: MessageDTO }
  | { type: "message.update"; channelId: string; message: MessageDTO }
  | { type: "typing"; channelId: string; userId: string; name: string }
  | { type: "read"; channelId: string }
  | { type: "notification"; notification: NotificationDTO }
  | { type: "notifications.read" }
