// Client-safe chat shapes.
import type { FileDTO } from "@/lib/files/types"

export type ChannelKindKey = "TEAM" | "CLIENT" | "DIRECT"

export type ChannelSummaryDTO = {
  id: string
  kind: ChannelKindKey
  /** Display name: channel name, client name, or the other person in a DM. */
  title: string
  clientId: string | null
  unread: number
  lastMessage: { authorName: string; preview: string; at: string } | null
}

export type MessageDTO = {
  id: string
  channelId: string
  authorId: string | null
  authorName: string
  /** Sent by a client portal account (styled differently for the team). */
  fromClient: boolean
  body: string
  createdAt: string
  editedAt: string | null
  deleted: boolean
  files: FileDTO[]
}
