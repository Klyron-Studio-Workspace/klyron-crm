import "server-only"

import { logEvent, systemActor, type Actor } from "@/lib/audit"
import { closeRoom, roomParticipantCount } from "@/lib/calls/livekit"
import { generateCallNotes, refreshCallCards } from "@/lib/calls/notes"
import { db } from "@/lib/db"

/**
 * Ends a call once (whoever gets there first: a person, the LiveKit webhook or
 * the scheduler), closes the LiveKit room and queues the AI notes.
 */
export async function finishCall(callId: string, actor: Actor = systemActor) {
  const call = await db.call.findUnique({ where: { id: callId }, include: { _count: { select: { segments: true } } } })
  if (!call) return false
  const now = new Date()
  const ended = await db.call.updateMany({
    where: { id: callId, status: "ACTIVE" },
    data: { status: "ENDED", endedAt: now, notesStatus: call._count.segments > 0 ? "PENDING" : "NONE" },
  })
  if (ended.count === 0) return false

  await db.callParticipant.updateMany({ where: { callId, leftAt: null }, data: { leftAt: now } })
  await closeRoom(call.roomName)
  await logEvent({
    actor,
    action: "call.end",
    entity: { type: "call", id: callId },
    metadata: { title: call.title, minutes: Math.max(1, Math.round((now.getTime() - call.startedAt.getTime()) / 60000)) },
  })
  await refreshCallCards(callId)
  if (call._count.segments > 0) void generateCallNotes(callId)
  return true
}

const EMPTY_GRACE_MS = 3 * 60_000
const MAX_CALL_MS = 12 * 60 * 60_000

/** Fallback when the LiveKit webhook isn't set up: end calls whose room has been empty for a few minutes. */
export async function endAbandonedCalls() {
  const active = await db.call.findMany({ where: { status: "ACTIVE", startedAt: { lt: new Date(Date.now() - EMPTY_GRACE_MS) } } })
  for (const call of active) {
    if (Date.now() - call.startedAt.getTime() > MAX_CALL_MS) {
      await finishCall(call.id)
      continue
    }
    const count = await roomParticipantCount(call.roomName)
    if (count !== 0) continue
    const lastLeft = await db.callParticipant.findFirst({ where: { callId: call.id }, orderBy: { leftAt: "desc" }, select: { leftAt: true } })
    const lastSeen = lastLeft?.leftAt ?? call.startedAt
    if (Date.now() - lastSeen.getTime() > EMPTY_GRACE_MS) await finishCall(call.id)
  }
}

/** Retries notes that were queued while the server restarted. */
export async function runPendingNotes() {
  const pending = await db.call.findMany({
    where: { status: "ENDED", notesStatus: "PENDING", notesModel: null },
    select: { id: true },
    take: 5,
  })
  for (const call of pending) await generateCallNotes(call.id)
}
