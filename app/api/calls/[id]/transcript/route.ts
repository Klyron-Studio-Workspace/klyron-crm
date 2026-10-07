import { z } from "zod"

import { getCurrentUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"

const MAX_SEGMENTS_PER_CALL = 20_000

const bodySchema = z.object({
  text: z.string().trim().min(1).max(2000),
  /** When the phrase started, from the speaker's browser (clamped to the call's time window). */
  spokenAt: z.iso.datetime(),
})

/**
 * Saves one finalized phrase from the speaker's own browser speech recognition.
 * Only people who joined this active call can add lines, and only as themselves.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/calls/[id]/transcript">) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 })
  const { id } = await params

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid transcript line." }, { status: 400 })

  const participant = await db.callParticipant.findUnique({
    where: { callId_userId: { callId: id, userId: user.id } },
    include: { call: { select: { status: true, startedAt: true } } },
  })
  if (!participant) return Response.json({ error: "Join the call first." }, { status: 403 })
  if (participant.call.status !== "ACTIVE") return Response.json({ error: "This call has ended." }, { status: 410 })
  if ((await db.transcriptSegment.count({ where: { callId: id } })) >= MAX_SEGMENTS_PER_CALL) {
    return Response.json({ error: "Transcript limit reached." }, { status: 429 })
  }

  const now = Date.now()
  const claimed = new Date(parsed.data.spokenAt).getTime()
  const spokenAt = new Date(Math.min(now, Math.max(participant.call.startedAt.getTime(), claimed)))
  await db.transcriptSegment.create({
    data: { callId: id, userId: user.id, speakerName: user.name, text: parsed.data.text, spokenAt },
  })
  return new Response(null, { status: 204 })
}
