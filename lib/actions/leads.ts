"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { echo, fieldErrorsFrom, type FormState } from "@/lib/actions/state"
import { logEvent, userActor } from "@/lib/audit"
import { can, requireTeamUser, type CurrentUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { currencies, leadSources, lostReasons, noteTypes } from "@/lib/leads/constants"
import { leadScope } from "@/lib/leads/queries"
import { notify } from "@/lib/notifications"

type Result = { ok: true; message?: string } | { ok: false; error: string }

const LEADS = "/leads"

async function requireLeadWriter() {
  const user = await requireTeamUser()
  if (!(await can(user, "leads", "WRITE"))) throw new Error("You don't have permission to edit leads.")
  return user
}

/** Loads a lead the user can see, or null. */
async function findScopedLead(user: CurrentUser, leadId: string) {
  return db.lead.findFirst({
    where: { AND: [await leadScope(user), { id: leadId }] },
    include: { stage: true },
  })
}

function revalidateLead(leadId: string) {
  revalidatePath(LEADS)
  revalidatePath(`${LEADS}/${leadId}`)
  revalidatePath("/")
  revalidatePath("/team")
}

/** Next position at the end of a stage column. */
async function endPosition(stageId: string) {
  const last = await db.lead.findFirst({ where: { stageId }, orderBy: { position: "desc" }, select: { position: true } })
  return (last?.position ?? 0) + 1
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)

const leadFields = {
  name: z.string().trim().min(1, "Enter a contact name.").max(120),
  company: optionalText(120),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("Enter a valid email."))]).transform((v) => v || null),
  phone: optionalText(40),
  website: z
    .string()
    .trim()
    .max(255)
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v || null)),
  source: z.enum(leadSources),
  value: z.coerce.number({ error: "Enter an amount." }).min(0, "Value can't be negative.").max(9_999_999_999),
  currency: z.enum(currencies),
  ownerId: z.string().transform((v) => (v && v !== "none" ? v : null)),
}

function parseServiceIds(formData: FormData) {
  return formData.getAll("serviceIds").map(String).filter(Boolean)
}

async function validOwner(ownerId: string | null) {
  if (!ownerId) return true
  const owner = await db.user.findFirst({
    where: { id: ownerId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MEMBER"] } },
  })
  return Boolean(owner)
}

const LEAD_ECHO = ["name", "company", "email", "phone", "website", "source", "value", "currency", "ownerId", "stageId"]

// ─── Create / update / delete ───────────────────────────────────────────────

const createSchema = z.object({ ...leadFields, stageId: z.string().min(1) })

export async function createLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireLeadWriter()
  const values = { ...echo(formData, LEAD_ECHO), serviceIds: parseServiceIds(formData).join(",") }
  const parsed = createSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const { stageId, ownerId, ...data } = parsed.data

  const stage = await db.pipelineStage.findUnique({ where: { id: stageId } })
  if (!stage) return { error: "That stage no longer exists. Reload and try again.", values }
  if (stage.kind === "LOST") return { error: "Create the lead in an open stage, then mark it lost.", values }
  if (!(await validOwner(ownerId))) return { fieldErrors: { ownerId: ["Choose an active team member."] }, values }

  // Members who only see their own leads must own what they create.
  const scope = await leadScope(user)
  const finalOwner = scope.ownerId ? user.id : ownerId

  const serviceIds = parseServiceIds(formData)
  const lead = await db.lead.create({
    data: {
      ...data,
      stageId,
      ownerId: finalOwner,
      createdById: user.id,
      position: await endPosition(stageId),
      closedAt: stage.kind === "WON" ? new Date() : null,
      services: { create: serviceIds.map((serviceId) => ({ serviceId })) },
    },
  })
  await logEvent({
    actor: userActor(user),
    action: "lead.create",
    entity: { type: "lead", id: lead.id },
    metadata: { name: lead.name, company: lead.company, stage: stage.name },
  })
  if (finalOwner && finalOwner !== user.id) {
    await notify({
      userIds: [finalOwner],
      type: "lead.assigned",
      title: `${user.name} assigned you a lead: ${lead.company ?? lead.name}`,
      link: `/leads/${lead.id}`,
    })
  }
  revalidateLead(lead.id)
  redirect(`${LEADS}/${lead.id}`)
}

const updateSchema = z.object({ ...leadFields, leadId: z.string().min(1) })

export async function updateLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireLeadWriter()
  const values = { ...echo(formData, LEAD_ECHO), serviceIds: parseServiceIds(formData).join(",") }
  const parsed = updateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const { leadId, ownerId, ...data } = parsed.data

  const lead = await findScopedLead(user, leadId)
  if (!lead) return { error: "Lead not found.", values }
  if (!(await validOwner(ownerId))) return { fieldErrors: { ownerId: ["Choose an active team member."] }, values }
  const scope = await leadScope(user)
  if (scope.ownerId && ownerId !== user.id) {
    return { fieldErrors: { ownerId: ["You can only keep leads assigned to yourself."] }, values }
  }

  const serviceIds = parseServiceIds(formData)
  await db.$transaction([
    db.lead.update({ where: { id: leadId }, data: { ...data, ownerId } }),
    db.leadService.deleteMany({ where: { leadId } }),
    db.leadService.createMany({ data: serviceIds.map((serviceId) => ({ leadId, serviceId })), skipDuplicates: true }),
  ])

  const changed = Object.keys(data).filter(
    (key) => String(lead[key as keyof typeof lead] ?? "") !== String(data[key as keyof typeof data] ?? "")
  )
  await logEvent({
    actor: userActor(user),
    action: "lead.update",
    entity: { type: "lead", id: leadId },
    metadata: { fields: changed },
  })
  if (lead.ownerId !== ownerId) {
    const owner = ownerId ? await db.user.findUnique({ where: { id: ownerId }, select: { name: true } }) : null
    await logEvent({
      actor: userActor(user),
      action: "lead.assign",
      entity: { type: "lead", id: leadId },
      metadata: { to: owner?.name ?? "Unassigned" },
    })
    if (ownerId) {
      await notify({
        userIds: [ownerId],
        excludeUserId: user.id,
        type: "lead.assigned",
        title: `${user.name} assigned you a lead: ${data.company ?? data.name}`,
        link: `/leads/${leadId}`,
      })
    }
  }
  revalidateLead(leadId)
  return { ok: true, message: "Lead updated." }
}

export async function deleteLead(leadId: string): Promise<Result> {
  const user = await requireLeadWriter()
  if (user.role === "MEMBER") return { ok: false, error: "Only Owners and Admins can delete leads." }
  const lead = await findScopedLead(user, leadId)
  if (!lead) return { ok: false, error: "Lead not found." }

  await db.lead.delete({ where: { id: leadId } })
  await logEvent({
    actor: userActor(user),
    action: "lead.delete",
    entity: { type: "lead", id: leadId },
    metadata: { name: lead.name, company: lead.company },
  })
  revalidatePath(LEADS)
  revalidatePath("/")
  redirect(LEADS)
}

// ─── Pipeline movement ──────────────────────────────────────────────────────

/** Fractional position so a move updates one row. Renumbers the column when gaps get too small. */
async function positionBefore(stageId: string, beforeLeadId: string | null, movingId: string) {
  if (!beforeLeadId) return endPosition(stageId)
  const before = await db.lead.findFirst({ where: { id: beforeLeadId, stageId }, select: { position: true } })
  if (!before) return endPosition(stageId)
  const prev = await db.lead.findFirst({
    where: { stageId, position: { lt: before.position }, id: { not: movingId } },
    orderBy: { position: "desc" },
    select: { position: true },
  })
  const lower = prev?.position ?? before.position - 1
  if (before.position - lower > 1e-6) return (lower + before.position) / 2

  const column = await db.lead.findMany({ where: { stageId, id: { not: movingId } }, orderBy: { position: "asc" }, select: { id: true } })
  let target = 0
  await db.$transaction(
    column.flatMap((row, index) => {
      if (row.id === beforeLeadId) target = index + 0.5
      return [db.lead.update({ where: { id: row.id }, data: { position: index + 1 } })]
    })
  )
  // Neighbours now sit at whole numbers; the moved lead goes halfway before its target.
  return target
}

const moveSchema = z.object({
  leadId: z.string().min(1),
  stageId: z.string().min(1),
  beforeLeadId: z.string().nullable(),
})

/** Drag and drop / "Move to" menu. Moving into a Lost stage must go through markLeadLost. */
export async function moveLead(leadId: string, stageId: string, beforeLeadId: string | null = null): Promise<Result> {
  const user = await requireLeadWriter()
  const parsed = moveSchema.safeParse({ leadId, stageId, beforeLeadId })
  if (!parsed.success) return { ok: false, error: "Invalid move." }

  const [lead, stage] = await Promise.all([
    findScopedLead(user, leadId),
    db.pipelineStage.findUnique({ where: { id: stageId } }),
  ])
  if (!lead || !stage) return { ok: false, error: "Lead or stage not found. Reload and try again." }
  if (stage.kind === "LOST" && lead.stageId !== stageId) {
    return { ok: false, error: "Add a lost reason to move this lead to Lost." }
  }

  const position = await positionBefore(stageId, beforeLeadId, leadId)
  const stageChanged = lead.stageId !== stageId
  await db.lead.update({
    where: { id: leadId },
    data: {
      stageId,
      position,
      ...(stageChanged
        ? {
            closedAt: stage.kind === "OPEN" ? null : new Date(),
            ...(stage.kind !== "LOST" ? { lostReason: null, lostDetail: null } : {}),
          }
        : {}),
    },
  })
  if (stageChanged) {
    await logEvent({
      actor: userActor(user),
      action: "lead.stage",
      entity: { type: "lead", id: leadId },
      metadata: { from: lead.stage.name, to: stage.name },
    })
  }
  revalidateLead(leadId)
  return { ok: true }
}

const lostSchema = z.object({
  leadId: z.string().min(1),
  stageId: z.string().min(1),
  reason: z.enum(lostReasons.map((r) => r.value) as [string, ...string[]]),
  detail: z.string().trim().max(500).optional(),
})

export async function markLeadLost(input: z.input<typeof lostSchema>): Promise<Result> {
  const user = await requireLeadWriter()
  const parsed = lostSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Choose a reason." }
  const { leadId, stageId, reason, detail } = parsed.data

  const [lead, stage] = await Promise.all([
    findScopedLead(user, leadId),
    db.pipelineStage.findUnique({ where: { id: stageId } }),
  ])
  if (!lead || !stage || stage.kind !== "LOST") return { ok: false, error: "Lead or stage not found." }

  await db.lead.update({
    where: { id: leadId },
    data: {
      stageId,
      position: await endPosition(stageId),
      lostReason: reason,
      lostDetail: detail || null,
      closedAt: new Date(),
    },
  })
  await logEvent({
    actor: userActor(user),
    action: "lead.lost",
    entity: { type: "lead", id: leadId },
    metadata: { from: lead.stage.name, to: stage.name, reason, detail: detail || null },
  })
  revalidateLead(leadId)
  return { ok: true, message: `${lead.name} marked as lost.` }
}

// ─── Convert ────────────────────────────────────────────────────────────────

/** Creates a Client from the lead and moves the lead to the Won stage. */
export async function convertLeadToClient(leadId: string): Promise<Result & { clientId?: string }> {
  const user = await requireLeadWriter()
  if (!(await can(user, "clients", "WRITE"))) return { ok: false, error: "You don't have permission to create clients." }
  const lead = await findScopedLead(user, leadId)
  if (!lead) return { ok: false, error: "Lead not found." }
  if (await db.client.findUnique({ where: { leadId } })) return { ok: false, error: "This lead is already a client." }

  const wonStage = await db.pipelineStage.findFirst({ where: { kind: "WON" }, orderBy: { position: "asc" } })
  if (!wonStage) return { ok: false, error: "Add a Won stage in Settings → Pipeline first." }

  const client = await db.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: {
        name: lead.company || lead.name,
        contactName: lead.company ? lead.name : null,
        email: lead.email,
        phone: lead.phone,
        website: lead.website,
        leadId: lead.id,
        ownerId: lead.ownerId,
      },
    })
    if (lead.stageId !== wonStage.id) {
      const last = await tx.lead.findFirst({ where: { stageId: wonStage.id }, orderBy: { position: "desc" }, select: { position: true } })
      await tx.lead.update({
        where: { id: lead.id },
        data: { stageId: wonStage.id, position: (last?.position ?? 0) + 1, closedAt: new Date(), lostReason: null, lostDetail: null },
      })
    }
    return created
  })

  await logEvent({
    actor: userActor(user),
    action: "lead.convert",
    entity: { type: "lead", id: leadId },
    metadata: { clientId: client.id, client: client.name, from: lead.stage.name, to: wonStage.name },
  })
  await logEvent({
    actor: userActor(user),
    action: "client.create",
    entity: { type: "client", id: client.id },
    metadata: { name: client.name, fromLead: leadId },
  })
  revalidateLead(leadId)
  revalidatePath("/clients")
  return { ok: true, message: `${client.name} is now a client.`, clientId: client.id }
}

// ─── Notes ──────────────────────────────────────────────────────────────────

const noteSchema = z.object({
  leadId: z.string().min(1),
  type: z.enum(noteTypes),
  body: z.string().trim().min(1, "Write something first.").max(10_000),
})

export async function addLeadNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireLeadWriter()
  const parsed = noteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, echo(formData, ["type", "body"]))
  const { leadId, type, body } = parsed.data
  if (!(await findScopedLead(user, leadId))) return { error: "Lead not found." }

  const note = await db.leadNote.create({
    data: { leadId, type, body, authorId: user.id, authorName: user.name },
  })
  await db.lead.update({ where: { id: leadId }, data: { updatedAt: new Date() } })
  await logEvent({
    actor: userActor(user),
    action: "lead.note.create",
    entity: { type: "lead", id: leadId },
    metadata: { noteId: note.id, type },
  })
  revalidateLead(leadId)
  return { ok: true, values: { type } }
}

export async function deleteLeadNote(noteId: string): Promise<Result> {
  const user = await requireLeadWriter()
  const note = await db.leadNote.findUnique({ where: { id: noteId } })
  if (!note || !(await findScopedLead(user, note.leadId))) return { ok: false, error: "Note not found." }
  if (note.authorId !== user.id && user.role === "MEMBER") {
    return { ok: false, error: "You can only delete your own notes." }
  }
  await db.leadNote.delete({ where: { id: noteId } })
  await logEvent({
    actor: userActor(user),
    action: "lead.note.delete",
    entity: { type: "lead", id: note.leadId },
    metadata: { type: note.type },
  })
  revalidateLead(note.leadId)
  return { ok: true }
}

// ─── Reminders ──────────────────────────────────────────────────────────────

const reminderSchema = z.object({
  leadId: z.string().min(1),
  note: z.string().trim().min(1, "What's the follow-up?").max(255),
  /** ISO string computed in the browser, so the user's time zone is respected. */
  dueAt: z.iso.datetime({ offset: true, error: "Pick a date and time." }),
  assigneeId: z.string().transform((v) => (v && v !== "none" ? v : null)),
})

export async function addReminder(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireLeadWriter()
  const values = echo(formData, ["note", "assigneeId", "dueLocal"])
  const parsed = reminderSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const { leadId, note, dueAt, assigneeId } = parsed.data
  if (!(await findScopedLead(user, leadId))) return { error: "Lead not found.", values }
  if (!(await validOwner(assigneeId))) return { fieldErrors: { assigneeId: ["Choose an active team member."] }, values }

  const reminder = await db.reminder.create({
    data: { leadId, note, dueAt: new Date(dueAt), assigneeId: assigneeId ?? user.id, createdById: user.id },
  })
  await logEvent({
    actor: userActor(user),
    action: "lead.reminder.create",
    entity: { type: "lead", id: leadId },
    metadata: { reminderId: reminder.id, note, dueAt },
  })
  revalidateLead(leadId)
  return { ok: true, message: "Follow-up scheduled." }
}

export async function setReminderDone(reminderId: string, done: boolean): Promise<Result> {
  const user = await requireLeadWriter()
  const reminder = await db.reminder.findUnique({ where: { id: reminderId } })
  if (!reminder || !(await findScopedLead(user, reminder.leadId))) return { ok: false, error: "Follow-up not found." }

  await db.reminder.update({ where: { id: reminderId }, data: { completedAt: done ? new Date() : null } })
  if (done) {
    await logEvent({
      actor: userActor(user),
      action: "lead.reminder.complete",
      entity: { type: "lead", id: reminder.leadId },
      metadata: { note: reminder.note },
    })
  }
  revalidateLead(reminder.leadId)
  return { ok: true }
}

export async function deleteReminder(reminderId: string): Promise<Result> {
  const user = await requireLeadWriter()
  const reminder = await db.reminder.findUnique({ where: { id: reminderId } })
  if (!reminder || !(await findScopedLead(user, reminder.leadId))) return { ok: false, error: "Follow-up not found." }
  await db.reminder.delete({ where: { id: reminderId } })
  revalidateLead(reminder.leadId)
  return { ok: true }
}
