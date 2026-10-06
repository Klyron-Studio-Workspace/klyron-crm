"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { echo, fieldErrorsFrom, type FormState } from "@/lib/actions/state"
import { logEvent, userActor } from "@/lib/audit"
import { can, requireTeamUser } from "@/lib/auth/dal"
import { checkPasswordPolicy, hashPassword } from "@/lib/auth/password"
import { revokeAllSessions } from "@/lib/auth/session"
import { generateTempPassword } from "@/lib/auth/tokens"
import { db } from "@/lib/db"
import { deleteStored } from "@/lib/files/storage"

type Result = { ok: true; message?: string; secret?: string } | { ok: false; error: string }

async function requireClientWriter() {
  const user = await requireTeamUser()
  if (!(await can(user, "clients", "WRITE"))) throw new Error("You don't have permission to edit clients.")
  return user
}

/** Portal accounts are created and managed by Owners and Admins only. */
async function requireAccountManager() {
  const user = await requireClientWriter()
  if (user.role === "MEMBER") throw new Error("Only Owners and Admins can manage client accounts.")
  return user
}

function revalidateClient(clientId: string) {
  revalidatePath("/clients")
  revalidatePath(`/clients/${clientId}`)
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)

const clientSchema = z.object({
  name: z.string().trim().min(1, "Enter the client's name.").max(120),
  contactName: optionalText(120),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("Enter a valid email."))]).transform((v) => v || null),
  phone: optionalText(40),
  website: z
    .string()
    .trim()
    .max(255)
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v || null)),
  ownerId: z.string().transform((v) => (v && v !== "none" ? v : null)),
  notes: optionalText(10_000),
})

const CLIENT_ECHO = ["name", "contactName", "email", "phone", "website", "ownerId", "notes"]

async function validOwner(ownerId: string | null) {
  if (!ownerId) return true
  return Boolean(
    await db.user.findFirst({ where: { id: ownerId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MEMBER"] } } })
  )
}

// ─── Client records ─────────────────────────────────────────────────────────

export async function createClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireClientWriter()
  const values = echo(formData, CLIENT_ECHO)
  const parsed = clientSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  if (!(await validOwner(parsed.data.ownerId))) return { fieldErrors: { ownerId: ["Choose an active team member."] }, values }

  const client = await db.client.create({ data: parsed.data })
  await logEvent({ actor: userActor(user), action: "client.create", entity: { type: "client", id: client.id }, metadata: { name: client.name } })
  revalidatePath("/clients")
  redirect(`/clients/${client.id}`)
}

export async function updateClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireClientWriter()
  const values = echo(formData, CLIENT_ECHO)
  const clientId = String(formData.get("clientId") ?? "")
  const parsed = clientSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const existing = await db.client.findUnique({ where: { id: clientId } })
  if (!existing) return { error: "Client not found.", values }
  if (!(await validOwner(parsed.data.ownerId))) return { fieldErrors: { ownerId: ["Choose an active team member."] }, values }

  await db.client.update({ where: { id: clientId }, data: parsed.data })
  const changed = (Object.keys(parsed.data) as (keyof typeof parsed.data)[]).filter(
    (key) => String(existing[key] ?? "") !== String(parsed.data[key] ?? "")
  )
  await logEvent({ actor: userActor(user), action: "client.update", entity: { type: "client", id: clientId }, metadata: { fields: changed } })
  revalidateClient(clientId)
  return { ok: true, message: "Client updated." }
}

export async function deleteClient(clientId: string): Promise<Result> {
  const user = await requireAccountManager()
  const client = await db.client.findUnique({ where: { id: clientId }, include: { _count: { select: { projects: true, invoices: true, proposals: true } } } })
  if (!client) return { ok: false, error: "Client not found." }
  if (client._count.projects > 0) return { ok: false, error: "Delete or move this client's projects first." }
  if (client._count.invoices + client._count.proposals > 0) return { ok: false, error: "This client has invoices or proposals, which are kept for your records." }

  // Portal accounts, chat and file records cascade in the database; remove the files on disk too.
  const files = await db.storedFile.findMany({ where: { clientId }, select: { storageKey: true, hasThumbnail: true } })
  await db.client.delete({ where: { id: clientId } })
  await Promise.all(files.map((f) => deleteStored(f.storageKey, f.hasThumbnail)))
  await logEvent({ actor: userActor(user), action: "client.delete", entity: { type: "client", id: clientId }, metadata: { name: client.name } })
  revalidatePath("/clients")
  redirect("/clients")
}

// ─── Portal accounts ────────────────────────────────────────────────────────

const accountSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(1, "Enter their name.").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email.")),
  password: z.string().superRefine((value, ctx) => {
    const error = checkPasswordPolicy(value)
    if (error) ctx.addIssue({ code: "custom", message: error })
  }),
  mustChangePassword: z.literal("on").optional(),
})

/** Creates a CLIENT login that only sees this client's portal. */
export async function createClientAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAccountManager()
  const values = echo(formData, ["name", "email", "mustChangePassword"])
  const parsed = accountSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const { clientId, name, email, password, mustChangePassword } = parsed.data

  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) return { error: "Client not found.", values }
  if (await db.user.findUnique({ where: { email } })) {
    return { fieldErrors: { email: ["Someone with this email already has an account."] }, values }
  }

  const account = await db.user.create({
    data: {
      name,
      email,
      role: "CLIENT",
      clientId,
      passwordHash: await hashPassword(password),
      mustChangePassword: mustChangePassword === "on",
    },
  })
  await logEvent({
    actor: userActor(actor),
    action: "client.account.create",
    entity: { type: "client", id: clientId },
    metadata: { userId: account.id, email, name },
  })
  revalidateClient(clientId)
  return {
    ok: true,
    message: `${name} can now sign in to the client portal.`,
    values: { email, mustChangePassword: mustChangePassword ?? "" },
  }
}

async function loadAccount(userId: string) {
  const account = await db.user.findUnique({ where: { id: userId } })
  if (!account || account.role !== "CLIENT" || !account.clientId) return null
  return account as typeof account & { clientId: string }
}

export async function resetClientPassword(userId: string): Promise<Result> {
  const actor = await requireAccountManager()
  const account = await loadAccount(userId)
  if (!account) return { ok: false, error: "Account not found." }

  const temp = generateTempPassword()
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(temp), passwordChangedAt: new Date(), mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
  })
  await revokeAllSessions(userId)
  await logEvent({ actor: userActor(actor), action: "client.account.password_reset", entity: { type: "client", id: account.clientId }, metadata: { email: account.email } })
  return { ok: true, message: `Temporary password for ${account.name}. It's shown once; they must change it at sign-in.`, secret: temp }
}

export async function setClientAccountStatus(userId: string, active: boolean): Promise<Result> {
  const actor = await requireAccountManager()
  const account = await loadAccount(userId)
  if (!account) return { ok: false, error: "Account not found." }

  await db.user.update({ where: { id: userId }, data: { status: active ? "ACTIVE" : "DISABLED" } })
  if (!active) await revokeAllSessions(userId)
  await logEvent({
    actor: userActor(actor),
    action: active ? "client.account.enable" : "client.account.disable",
    entity: { type: "client", id: account.clientId },
    metadata: { email: account.email },
  })
  revalidateClient(account.clientId)
  return { ok: true, message: `${account.name} ${active ? "can sign in again" : "can no longer sign in"}.` }
}

export async function removeClientAccount(userId: string): Promise<Result> {
  const actor = await requireAccountManager()
  const account = await loadAccount(userId)
  if (!account) return { ok: false, error: "Account not found." }

  await db.user.delete({ where: { id: userId } })
  await logEvent({
    actor: userActor(actor),
    action: "client.account.remove",
    entity: { type: "client", id: account.clientId },
    metadata: { email: account.email, name: account.name },
  })
  revalidateClient(account.clientId)
  return { ok: true, message: `${account.name}'s portal access was removed.` }
}
