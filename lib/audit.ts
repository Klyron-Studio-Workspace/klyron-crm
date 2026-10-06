import "server-only"

import { db } from "@/lib/db"
import type { ActorType, Prisma } from "@/lib/generated/prisma/client"
import { getRequestInfo } from "@/lib/request"

export type Actor = {
  type: ActorType
  id: string | null
  name: string | null
}

export const systemActor: Actor = { type: "SYSTEM", id: null, name: "System" }

export function userActor(user: { id: string; name: string }): Actor {
  return { type: "USER", id: user.id, name: user.name }
}

type LogEventInput = {
  actor: Actor
  /** Dot-namespaced verb, e.g. "auth.login", "team.member.create". */
  action: string
  entity?: { type: string; id: string }
  metadata?: Prisma.InputJsonValue
}

/**
 * Write one event. The same log powers the audit log, activity feeds,
 * timelines and notifications, so every mutation should call this.
 */
export async function logEvent({ actor, action, entity, metadata }: LogEventInput) {
  const { ipAddress, userAgent } = await getRequestInfo()
  await db.event.create({
    data: {
      actorType: actor.type,
      actorId: actor.id,
      actorName: actor.name,
      action,
      entityType: entity?.type,
      entityId: entity?.id,
      metadata,
      ipAddress,
      userAgent,
    },
  })
}
