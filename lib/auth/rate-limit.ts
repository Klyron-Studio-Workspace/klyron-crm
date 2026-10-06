import "server-only"

import { db } from "@/lib/db"

const WINDOW_MS = 15 * 60 * 1000
/** Failed attempts from one IP (any email) before that IP is throttled. */
const MAX_FAILS_PER_IP = 20
/** Failed attempts on one email (any IP) before that email is throttled. */
const MAX_FAILS_PER_EMAIL = 10
/** Consecutive failures that lock an existing account. */
export const LOCKOUT_THRESHOLD = 5
export const LOCKOUT_MS = 15 * 60 * 1000

export async function isLoginThrottled(email: string, ipAddress: string | null) {
  const since = new Date(Date.now() - WINDOW_MS)
  const [emailFails, ipFails] = await Promise.all([
    db.loginAttempt.count({ where: { email, success: false, createdAt: { gte: since } } }),
    ipAddress
      ? db.loginAttempt.count({ where: { ipAddress, success: false, createdAt: { gte: since } } })
      : Promise.resolve(0),
  ])
  return emailFails >= MAX_FAILS_PER_EMAIL || ipFails >= MAX_FAILS_PER_IP
}

export async function recordLoginAttempt(email: string, ipAddress: string | null, success: boolean) {
  await db.loginAttempt.create({ data: { email, ipAddress, success } })
}
