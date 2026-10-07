import { finishCall } from "@/lib/calls/lifecycle"
import { webhookReceiver } from "@/lib/calls/livekit"
import { db } from "@/lib/db"

/**
 * LiveKit server webhooks (configure in livekit.yaml → webhook.urls).
 * Signed with the API secret; unsigned or forged requests are rejected.
 * Optional: without it, the scheduler ends empty calls after a few minutes.
 */
export async function POST(request: Request) {
  const receiver = webhookReceiver()
  if (!receiver) return new Response("Calls not configured", { status: 503 })

  let event
  try {
    event = await receiver.receive(await request.text(), request.headers.get("authorization") ?? undefined)
  } catch {
    return new Response("Invalid signature", { status: 401 })
  }

  const roomName = event.room?.name
  const call = roomName ? await db.call.findUnique({ where: { roomName }, select: { id: true, status: true } }) : null
  if (!call) return new Response(null, { status: 204 })

  if (event.event === "participant_left" && event.participant?.identity) {
    await db.callParticipant.updateMany({ where: { callId: call.id, userId: event.participant.identity, leftAt: null }, data: { leftAt: new Date() } })
  }
  if (event.event === "room_finished" && call.status === "ACTIVE") {
    await finishCall(call.id)
  }
  return new Response(null, { status: 204 })
}
