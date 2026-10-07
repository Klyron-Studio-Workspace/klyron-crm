import { can, getCurrentUser } from "@/lib/auth/dal"
import { createJoinToken, isCallsConfigured } from "@/lib/calls/livekit"
import { findAccessibleCall } from "@/lib/calls/queries"
import { db } from "@/lib/db"

/** Issues a LiveKit join token for an active call the user can see. */
export async function POST(_request: Request, { params }: RouteContext<"/api/calls/[id]/token">) {
  const user = await getCurrentUser()
  if (!user || user.mustChangePassword) return Response.json({ error: "Sign in to join calls." }, { status: 401 })
  if (!(await can(user, "chat", "WRITE"))) return Response.json({ error: "You don't have permission to join calls." }, { status: 403 })

  const { id } = await params
  const access = await findAccessibleCall(user, id)
  if (!access) return Response.json({ error: "Call not found." }, { status: 404 })
  if (access.call.status !== "ACTIVE") return Response.json({ error: "This call has ended." }, { status: 410 })

  if (!isCallsConfigured()) return Response.json({ error: "Video calls aren't set up yet." }, { status: 503 })

  // Joining twice (another tab, a reconnect) must not fail, so no upsert race here.
  await db.callParticipant.createMany({ data: [{ callId: id, userId: user.id }], skipDuplicates: true })
  await db.callParticipant.updateMany({ where: { callId: id, userId: user.id, leftAt: { not: null } }, data: { leftAt: null } })
  const { token, url } = await createJoinToken(access.call.roomName, user, true)
  return Response.json({ token, url }, { headers: { "Cache-Control": "no-store" } })
}
