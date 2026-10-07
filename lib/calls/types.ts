// Client-safe call shapes.

export type ActionItem = { text: string; owner: string | null; due: string | null }

export type CallNotesDTO = {
  summary: string | null
  decisions: string[]
  actionItems: ActionItem[]
  model: string | null
  generatedAt: string | null
  error: string | null
}

export type CallDetailDTO = {
  id: string
  title: string
  status: "ACTIVE" | "ENDED"
  notesStatus: "NONE" | "PENDING" | "READY" | "FAILED"
  channel: { id: string; kind: "TEAM" | "CLIENT" | "DIRECT" | "GROUP"; title: string }
  startedBy: string | null
  startedById: string | null
  startedAt: string
  endedAt: string | null
  participants: { id: string; name: string }[]
  notes: CallNotesDTO
  transcript: { id: string; speakerName: string; text: string; spokenAt: string }[]
}

export type CallSummaryDTO = Omit<CallDetailDTO, "transcript" | "notes"> & { summary: string | null; segmentCount: number }
