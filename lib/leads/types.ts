// Client-safe shapes passed from server components to client components.
import type { LeadSourceKey, NoteTypeKey, StageToneKey } from "./constants"

export type StageKindKey = "OPEN" | "WON" | "LOST"

export type StageDTO = {
  id: string
  name: string
  kind: StageKindKey
  tone: StageToneKey
  position: number
}

export type PersonDTO = { id: string; name: string }

export type LeadCardDTO = {
  id: string
  name: string
  company: string | null
  value: number
  currency: string
  source: LeadSourceKey
  stageId: string
  position: number
  owner: PersonDTO | null
  services: string[]
  /** Earliest open follow-up, ISO string. */
  nextFollowUp: string | null
  updatedAt: string
}

export type BoardColumnDTO = StageDTO & { leads: LeadCardDTO[] }

export type ServiceDTO = { id: string; name: string; description: string | null; active: boolean }

export type ReminderDTO = {
  id: string
  note: string
  dueAt: string
  completedAt: string | null
  assignee: PersonDTO | null
}

export type TimelineItem =
  | {
      kind: "note"
      id: string
      type: NoteTypeKey
      body: string
      authorId: string | null
      authorName: string
      at: string
    }
  | {
      kind: "event"
      id: string
      action: string
      actorName: string | null
      metadata: Record<string, unknown> | null
      at: string
    }

export type LeadDetailDTO = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  source: LeadSourceKey
  value: number
  currency: string
  stage: StageDTO
  owner: PersonDTO | null
  serviceIds: string[]
  lostReason: string | null
  lostDetail: string | null
  closedAt: string | null
  createdAt: string
  client: { id: string; name: string } | null
  reminders: ReminderDTO[]
  timeline: TimelineItem[]
}
