"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { echo, fieldErrorsFrom, type FormState } from "@/lib/actions/state"
import { logEvent, userActor } from "@/lib/audit"
import { getCurrentUser, requireUser } from "@/lib/auth/dal"
import { checkPasswordPolicy, hashPassword, verifyPassword } from "@/lib/auth/password"
import { isTeamRole } from "@/lib/auth/permissions"
import {
  isLoginThrottled,
  LOCKOUT_MS,
  LOCKOUT_THRESHOLD,
  recordLoginAttempt,
} from "@/lib/auth/rate-limit"
import { createSession, destroyCurrentSession, revokeAllSessions } from "@/lib/auth/session"
import { generateToken, hashToken } from "@/lib/auth/tokens"
import { db } from "@/lib/db"
import { sendMail } from "@/lib/mail"
import { appUrl, getRequestInfo } from "@/lib/request"

const RESET_TTL_MS = 60 * 60 * 1000
const INVALID_CREDENTIALS = "Email or password is incorrect."

// Verified when the email is unknown, so response time doesn't reveal which accounts exist.
let dummyHash: Promise<string> | undefined
const getDummyHash = () => (dummyHash ??= hashPassword(generateToken()))

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email."))

const newPassword = z.string().superRefine((value, ctx) => {
  const error = checkPasswordPolicy(value)
  if (error) ctx.addIssue({ code: "custom", message: error })
})

// ─── Login / logout ─────────────────────────────────────────────────────────

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(256),
})

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = echo(formData, ["email"])
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const { email, password } = parsed.data
  const { ipAddress } = await getRequestInfo()

  if (await isLoginThrottled(email, ipAddress)) {
    return { error: "Too many sign-in attempts. Wait 15 minutes and try again.", values }
  }

  const user = await db.user.findUnique({ where: { email } })
  if (!user) {
    await verifyPassword(await getDummyHash(), password)
    await recordLoginAttempt(email, ipAddress, false)
    return { error: INVALID_CREDENTIALS, values }
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordLoginAttempt(email, ipAddress, false)
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    return { error: `This account is temporarily locked. Try again in ${minutes} min.` }
  }

  const valid = await verifyPassword(user.passwordHash, password)
  if (!valid || user.status !== "ACTIVE") {
    await recordLoginAttempt(email, ipAddress, false)
    if (!valid) {
      const fails = user.failedLoginCount + 1
      const locked = fails >= LOCKOUT_THRESHOLD
      await db.user.update({
        where: { id: user.id },
        data: locked
          ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) }
          : { failedLoginCount: fails },
      })
      await logEvent({
        actor: userActor(user),
        action: locked ? "auth.lockout" : "auth.login.failed",
        entity: { type: "user", id: user.id },
      })
      if (locked) return { error: "Too many failed attempts. This account is locked for 15 min.", values }
    }
    return { error: INVALID_CREDENTIALS, values }
  }

  await recordLoginAttempt(email, ipAddress, true)
  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  })
  await createSession(user.id)
  await logEvent({ actor: userActor(user), action: "auth.login", entity: { type: "user", id: user.id } })

  if (user.mustChangePassword) redirect("/change-password")
  redirect(isTeamRole(user.role) ? "/" : "/portal")
}

export async function logout() {
  const user = await getCurrentUser()
  await destroyCurrentSession()
  if (user) {
    await logEvent({ actor: userActor(user), action: "auth.logout", entity: { type: "user", id: user.id } })
  }
  redirect("/login")
}

// ─── Password reset (self-service) ──────────────────────────────────────────

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error)

  const sent: FormState = {
    ok: true,
    message: "If an account exists for that email, a reset link is on its way.",
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } })
  // Team members reset by email; client accounts are reset by an admin.
  if (!user || user.status !== "ACTIVE" || !isTeamRole(user.role)) return sent

  const token = generateToken()
  await db.passwordResetToken.create({
    data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  })
  await sendMail({
    to: user.email,
    subject: "Reset your Klyron CRM password",
    text: "Someone (hopefully you) asked to reset your Klyron CRM password. The link works for 1 hour. If this wasn't you, you can ignore this email.",
    action: { label: "Choose a new password", url: appUrl(`/reset-password/${token}`) },
  })
  await logEvent({ actor: userActor(user), action: "auth.password_reset.request", entity: { type: "user", id: user.id } })
  return sent
}

const resetSchema = z
  .object({ token: z.string().min(1), password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." })

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error)

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
    include: { user: true },
  })
  if (!record || record.usedAt || record.expiresAt < new Date() || record.user.status !== "ACTIVE") {
    return { error: "This reset link is invalid or has expired. Request a new one." }
  }

  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ])
  await revokeAllSessions(record.userId)
  await logEvent({ actor: userActor(record.user), action: "auth.password_reset.complete", entity: { type: "user", id: record.userId } })
  redirect("/login?reset=1")
}

// ─── Own account ────────────────────────────────────────────────────────────

const changeSchema = z
  .object({ current: z.string().min(1, "Enter your current password."), password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." })
  .refine((v) => v.password !== v.current, { path: ["password"], message: "Choose a different password." })

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser({ allowPasswordChange: true })
  const parsed = changeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error)

  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } })
  if (!(await verifyPassword(user.passwordHash, parsed.data.current))) {
    return { fieldErrors: { current: ["Current password is incorrect."] } }
  }

  await db.user.update({
    where: { id: me.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    },
  })
  await revokeAllSessions(me.id, me.sessionId)
  await logEvent({ actor: userActor(me), action: "auth.password.change", entity: { type: "user", id: me.id } })

  if (me.mustChangePassword) redirect(isTeamRole(me.role) ? "/" : "/portal")
  revalidatePath("/settings/security")
  return { ok: true, message: "Password updated. Other devices were signed out." }
}

export async function revokeSession(sessionId: string) {
  const me = await requireUser()
  const result = await db.session.updateMany({
    where: { id: sessionId, userId: me.id, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (result.count) {
    await logEvent({ actor: userActor(me), action: "auth.session.revoke", entity: { type: "session", id: sessionId } })
  }
  if (sessionId === me.sessionId) await logout()
  revalidatePath("/settings/security")
}

export async function revokeOtherSessions() {
  const me = await requireUser()
  await revokeAllSessions(me.id, me.sessionId)
  await logEvent({ actor: userActor(me), action: "auth.session.revoke_others", entity: { type: "user", id: me.id } })
  revalidatePath("/settings/security")
}
