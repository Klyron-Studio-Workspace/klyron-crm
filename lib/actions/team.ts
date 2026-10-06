"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { echo, fieldErrorsFrom, type FormState } from "@/lib/actions/state"
import { logEvent, userActor } from "@/lib/audit"
import { can, requireTeamUser, type CurrentUser } from "@/lib/auth/dal"
import { checkPasswordPolicy, hashPassword } from "@/lib/auth/password"
import { manageableRoles, roleLabels } from "@/lib/auth/permissions"
import { revokeAllSessions } from "@/lib/auth/session"
import { generateTempPassword } from "@/lib/auth/tokens"
import { db } from "@/lib/db"
import type { Role, UserStatus } from "@/lib/generated/prisma/enums"

const TEAM_PATH = "/settings/team"

type Result = { ok: true; message?: string; secret?: string } | { ok: false; error: string }

async function requireTeamManager() {
  const actor = await requireTeamUser()
  if (!(await can(actor, "team", "WRITE"))) throw new Error("You don't have permission to manage the team.")
  return actor
}

/** Loads a target user the actor is allowed to manage, or returns an error. */
async function loadManageable(actor: CurrentUser, userId: string) {
  if (userId === actor.id) return { ok: false, error: "You can't change your own account here." } as const
  const target = await db.user.findUnique({ where: { id: userId } })
  if (!target) return { ok: false, error: "User not found." } as const
  if (!manageableRoles(actor.role).includes(target.role)) {
    return { ok: false, error: `Only an Owner can manage ${roleLabels[target.role]} accounts.` } as const
  }
  return { ok: true, target } as const
}

async function isLastActiveOwner(userId: string) {
  const owners = await db.user.count({ where: { role: "OWNER", status: "ACTIVE", id: { not: userId } } })
  return owners === 0
}

// ─── Create ─────────────────────────────────────────────────────────────────

const createMemberSchema = z.object({
  name: z.string().trim().min(1, "Enter their name.").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email.")),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
  password: z.string().superRefine((value, ctx) => {
    const error = checkPasswordPolicy(value)
    if (error) ctx.addIssue({ code: "custom", message: error })
  }),
  mustChangePassword: z.literal("on").optional(),
})

/** Creates a team account with a password set by the admin. They sign in on the normal login page. */
export async function createMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireTeamManager()
  // Never echo the password back.
  const values = echo(formData, ["name", "email", "role", "mustChangePassword"])
  const parsed = createMemberSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const { name, email, role, password, mustChangePassword } = parsed.data

  if (!manageableRoles(actor.role).includes(role)) {
    return { fieldErrors: { role: [`Only an Owner can add ${roleLabels[role]}s.`] }, values }
  }
  if (await db.user.findUnique({ where: { email } })) {
    return { fieldErrors: { email: ["Someone with this email already has an account."] }, values }
  }

  const user = await db.user.create({
    data: {
      name,
      email,
      role,
      passwordHash: await hashPassword(password),
      mustChangePassword: mustChangePassword === "on",
    },
  })
  await logEvent({
    actor: userActor(actor),
    action: "team.member.create",
    entity: { type: "user", id: user.id },
    metadata: { email, name, role },
  })
  revalidatePath(TEAM_PATH)
  revalidatePath("/team")
  return {
    ok: true,
    message: `${name} can now sign in.`,
    values: { email, mustChangePassword: mustChangePassword ?? "" },
  }
}

// ─── Members ────────────────────────────────────────────────────────────────

export async function changeRole(userId: string, role: Role): Promise<Result> {
  const actor = await requireTeamManager()
  const loaded = await loadManageable(actor, userId)
  if (!loaded.ok) return loaded
  const { target } = loaded

  if (role === "CLIENT" || target.role === "CLIENT") {
    return { ok: false, error: "Team and client accounts can't be converted into each other." }
  }
  if (!manageableRoles(actor.role).includes(role)) {
    return { ok: false, error: `Only an Owner can assign the ${roleLabels[role]} role.` }
  }
  if (target.role === "OWNER" && role !== "OWNER" && (await isLastActiveOwner(target.id))) {
    return { ok: false, error: "The studio needs at least one active Owner." }
  }

  await db.user.update({ where: { id: target.id }, data: { role } })
  await logEvent({
    actor: userActor(actor),
    action: "team.member.role",
    entity: { type: "user", id: target.id },
    metadata: { from: target.role, to: role },
  })
  revalidatePath(TEAM_PATH)
  return { ok: true, message: `${target.name} is now ${roleLabels[role]}.` }
}

export async function setStatus(userId: string, status: UserStatus): Promise<Result> {
  const actor = await requireTeamManager()
  const loaded = await loadManageable(actor, userId)
  if (!loaded.ok) return loaded
  const { target } = loaded

  if (status === "DISABLED" && target.role === "OWNER" && (await isLastActiveOwner(target.id))) {
    return { ok: false, error: "The studio needs at least one active Owner." }
  }

  await db.user.update({ where: { id: target.id }, data: { status } })
  if (status === "DISABLED") await revokeAllSessions(target.id)
  await logEvent({
    actor: userActor(actor),
    action: status === "DISABLED" ? "team.member.disable" : "team.member.enable",
    entity: { type: "user", id: target.id },
  })
  revalidatePath(TEAM_PATH)
  return { ok: true, message: `${target.name} ${status === "DISABLED" ? "can no longer sign in" : "can sign in again"}.` }
}

export async function removeMember(userId: string): Promise<Result> {
  const actor = await requireTeamManager()
  const loaded = await loadManageable(actor, userId)
  if (!loaded.ok) return loaded
  const { target } = loaded

  if (target.role === "OWNER" && (await isLastActiveOwner(target.id))) {
    return { ok: false, error: "The studio needs at least one active Owner." }
  }

  await db.user.delete({ where: { id: target.id } })
  await logEvent({
    actor: userActor(actor),
    action: "team.member.remove",
    entity: { type: "user", id: target.id },
    metadata: { email: target.email, name: target.name, role: target.role },
  })
  revalidatePath(TEAM_PATH)
  return { ok: true, message: `${target.name} was removed.` }
}

/** Sets a one-time temporary password, signs the user out everywhere and forces a change at next login. */
export async function adminResetPassword(userId: string): Promise<Result> {
  const actor = await requireTeamManager()
  const loaded = await loadManageable(actor, userId)
  if (!loaded.ok) return loaded
  const { target } = loaded

  const tempPassword = generateTempPassword()
  await db.user.update({
    where: { id: target.id },
    data: {
      passwordHash: await hashPassword(tempPassword),
      passwordChangedAt: new Date(),
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  })
  await revokeAllSessions(target.id)
  await logEvent({ actor: userActor(actor), action: "team.member.password_reset", entity: { type: "user", id: target.id } })
  return {
    ok: true,
    message: `Temporary password for ${target.name}. It is shown once; they must change it at sign-in.`,
    secret: tempPassword,
  }
}
