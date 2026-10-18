// Client-safe event shapes sent over /api/events (Server-Sent Events).
import type { MessageDTO } from "@/lib/chat/types"
import type { BoardDocument } from "@/lib/whiteboard/document"

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
  | { type: "whiteboard.update"; boardId: string; revision: number; document: BoardDocument; actorId: string }
  | { type: "whiteboard.presence"; boardId: string; userId: string; name: string; x: number | null; y: number | null; selected: string[] }
  | { type: "whiteboard.comment"; boardId: string; comment: { id: string; body: string; x: number; y: number; author: string; createdAt: string; resolvedAt: string | null } }
  | { type: "whiteboard.comment.resolve"; boardId: string; commentId: string }
  | { type: "mail.inbound"; mailboxId: string; emailId: string; fromName: string | null; subject: string }
