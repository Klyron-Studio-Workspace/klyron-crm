import "server-only"

import { cookies } from "next/headers"

import { generateToken, hashToken } from "@/lib/auth/tokens"
import { db } from "@/lib/db"
import { getRequestInfo } from "@/lib/request"

const isProduction = process.env.NODE_ENV === "production"

/** `__Host-` prefix in production: HTTPS only, no Domain attribute, Path=/. */
export const SESSION_COOKIE = isProduction ? "__Host-klyron_session" : "klyron_session"
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const TOUCH_INTERVAL_MS = 5 * 60 * 1000

export async function createSession(userId: string) {
  const token = generateToken()
  const { ipAddress, userAgent } = await getRequestInfo()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await db.session.create({
    data: { tokenHash: hashToken(token), userId, ipAddress, userAgent, expiresAt },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
}

export async function readSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null
}

/** Validates the cookie against the database. Returns the session with its user, or null. */
export async function validateSessionToken(token: string) {
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })
  if (!session) return null

  const now = Date.now()
  if (
    session.revokedAt ||
    session.expiresAt.getTime() <= now ||
    session.user.status !== "ACTIVE"
  ) {
    return null
  }

  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(now) },
    })
  }
  return session
}

/** Revokes the current session and clears the cookie. */
export async function destroyCurrentSession() {
  const token = await readSessionToken()
  if (token) {
    await db.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  ;(await cookies()).delete(SESSION_COOKIE)
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  })
}
