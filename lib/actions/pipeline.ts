"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { echo, fieldErrorsFrom, type FormState } from "@/lib/actions/state"
import { logEvent, userActor } from "@/lib/audit"
import { can, requireTeamUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { stageTones } from "@/lib/leads/constants"

type Result = { ok: true; message?: string } | { ok: false; error: string }

async function requireSettingsWriter() {
  const user = await requireTeamUser()
  if (!(await can(user, "settings", "WRITE"))) throw new Error("You don't have permission to change settings.")
  return user
}

function revalidatePipeline() {
  revalidatePath("/settings/pipeline")
  revalidatePath("/leads")
}

// ─── Stages ─────────────────────────────────────────────────────────────────

const stageSchema = z.object({
  name: z.string().trim().min(1, "Enter a stage name.").max(60),
  tone: z.enum(stageTones),
})

export async function createStage(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSettingsWriter()
  const values = echo(formData, ["name", "tone"])
  const parsed = stageSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)

  // New open stages go just before the first closed (Won/Lost) stage.
  const stages = await db.pipelineStage.findMany({ orderBy: { position: "asc" } })
  const firstClosed = stages.findIndex((s) => s.kind !== "OPEN")
  const insertAt = firstClosed === -1 ? stages.length : firstClosed

  const stage = await db.$transaction(async (tx) => {
    for (const s of stages.slice(insertAt)) {
      await tx.pipelineStage.update({ where: { id: s.id }, data: { position: s.position + 1 } })
    }
    return tx.pipelineStage.create({ data: { ...parsed.data, kind: "OPEN", position: insertAt } })
  })
  await logEvent({ actor: userActor(user), action: "pipeline.stage.create", entity: { type: "stage", id: stage.id }, metadata: { name: stage.name } })
  revalidatePipeline()
  return { ok: true, message: `Added "${stage.name}".` }
}

export async function updateStage(stageId: string, input: { name: string; tone: string }): Promise<Result> {
  const user = await requireSettingsWriter()
  const parsed = stageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid stage." }
  const stage = await db.pipelineStage.findUnique({ where: { id: stageId } })
  if (!stage) return { ok: false, error: "Stage not found." }

  await db.pipelineStage.update({ where: { id: stageId }, data: parsed.data })
  await logEvent({
    actor: userActor(user),
    action: "pipeline.stage.update",
    entity: { type: "stage", id: stageId },
    metadata: { from: stage.name, to: parsed.data.name, tone: parsed.data.tone },
  })
  revalidatePipeline()
  return { ok: true }
}

/** Swap with the neighbour. Open stages stay before Won/Lost. */
export async function moveStage(stageId: string, direction: "up" | "down"): Promise<Result> {
  await requireSettingsWriter()
  const stages = await db.pipelineStage.findMany({ orderBy: { position: "asc" } })
  const index = stages.findIndex((s) => s.id === stageId)
  const other = stages[direction === "up" ? index - 1 : index + 1]
  const stage = stages[index]
  if (!stage || !other) return { ok: false, error: "Can't move further." }
  if (stage.kind !== other.kind && (stage.kind === "OPEN" || other.kind === "OPEN")) {
    return { ok: false, error: "Open stages stay before Won and Lost." }
  }
  await db.$transaction([
    db.pipelineStage.update({ where: { id: stage.id }, data: { position: other.position } }),
    db.pipelineStage.update({ where: { id: other.id }, data: { position: stage.position } }),
  ])
  revalidatePipeline()
  return { ok: true }
}

/** Deletes a stage, moving its leads to another stage of the same kind. */
export async function deleteStage(stageId: string, moveToStageId: string | null): Promise<Result> {
  const user = await requireSettingsWriter()
  const stage = await db.pipelineStage.findUnique({ where: { id: stageId }, include: { _count: { select: { leads: true } } } })
  if (!stage) return { ok: false, error: "Stage not found." }

  const sameKind = await db.pipelineStage.count({ where: { kind: stage.kind } })
  if (stage.kind !== "OPEN" && sameKind <= 1) {
    return { ok: false, error: `The pipeline needs a ${stage.kind === "WON" ? "Won" : "Lost"} stage.` }
  }
  if (stage.kind === "OPEN" && sameKind <= 1) return { ok: false, error: "The pipeline needs at least one open stage." }

  let target = null
  if (stage._count.leads > 0) {
    target = moveToStageId ? await db.pipelineStage.findUnique({ where: { id: moveToStageId } }) : null
    if (!target || target.id === stageId) return { ok: false, error: "Choose where to move this stage's leads." }
    if (target.kind !== stage.kind) return { ok: false, error: "Move leads to a stage of the same type." }
  }

  await db.$transaction(async (tx) => {
    if (target) {
      const last = await tx.lead.findFirst({ where: { stageId: target.id }, orderBy: { position: "desc" }, select: { position: true } })
      const leads = await tx.lead.findMany({ where: { stageId }, orderBy: { position: "asc" }, select: { id: true } })
      let position = (last?.position ?? 0) + 1
      for (const lead of leads) {
        await tx.lead.update({ where: { id: lead.id }, data: { stageId: target.id, position: position++ } })
      }
    }
    await tx.pipelineStage.delete({ where: { id: stageId } })
    const rest = await tx.pipelineStage.findMany({ orderBy: { position: "asc" } })
    for (const [position, s] of rest.entries()) {
      await tx.pipelineStage.update({ where: { id: s.id }, data: { position } })
    }
  })
  await logEvent({
    actor: userActor(user),
    action: "pipeline.stage.delete",
    entity: { type: "stage", id: stageId },
    metadata: { name: stage.name, movedTo: target?.name ?? null, leads: stage._count.leads },
  })
  revalidatePipeline()
  return { ok: true, message: `Deleted "${stage.name}".` }
}

// ─── Services ───────────────────────────────────────────────────────────────

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Enter a service name.").max(80),
  description: z
    .string()
    .trim()
    .max(255)
    .transform((v) => v || null),
})

export async function createService(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSettingsWriter()
  const values = echo(formData, ["name", "description"])
  const parsed = serviceSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  if (await db.service.findUnique({ where: { name: parsed.data.name } })) {
    return { fieldErrors: { name: ["A service with this name already exists."] }, values }
  }
  const last = await db.service.findFirst({ orderBy: { position: "desc" }, select: { position: true } })
  const service = await db.service.create({ data: { ...parsed.data, position: (last?.position ?? 0) + 1 } })
  await logEvent({ actor: userActor(user), action: "service.create", entity: { type: "service", id: service.id }, metadata: { name: service.name } })
  revalidatePath("/settings/services")
  return { ok: true, message: `Added "${service.name}".` }
}

export async function updateService(serviceId: string, input: { name: string; description: string }): Promise<Result> {
  const user = await requireSettingsWriter()
  const parsed = serviceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid service." }
  const clash = await db.service.findFirst({ where: { name: parsed.data.name, id: { not: serviceId } } })
  if (clash) return { ok: false, error: "A service with this name already exists." }
  await db.service.update({ where: { id: serviceId }, data: parsed.data })
  await logEvent({ actor: userActor(user), action: "service.update", entity: { type: "service", id: serviceId }, metadata: { name: parsed.data.name } })
  revalidatePath("/settings/services")
  return { ok: true }
}

/** Archive instead of delete when a service is in use, so lead history stays intact. */
export async function setServiceActive(serviceId: string, active: boolean): Promise<Result> {
  const user = await requireSettingsWriter()
  const service = await db.service.update({ where: { id: serviceId }, data: { active } })
  await logEvent({
    actor: userActor(user),
    action: active ? "service.restore" : "service.archive",
    entity: { type: "service", id: serviceId },
    metadata: { name: service.name },
  })
  revalidatePath("/settings/services")
  return { ok: true }
}

export async function deleteService(serviceId: string): Promise<Result> {
  const user = await requireSettingsWriter()
  const service = await db.service.findUnique({ where: { id: serviceId }, include: { _count: { select: { leads: true } } } })
  if (!service) return { ok: false, error: "Service not found." }
  if (service._count.leads > 0) return { ok: false, error: "This service is on existing leads. Archive it instead." }
  await db.service.delete({ where: { id: serviceId } })
  await logEvent({ actor: userActor(user), action: "service.delete", entity: { type: "service", id: serviceId }, metadata: { name: service.name } })
  revalidatePath("/settings/services")
  return { ok: true }
}

const priceSchema = z.object({
  price: z
    .string()
    .trim()
    .transform((v) => v.replace(/,/g, ""))
    .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 1e10), "Enter a price like 1500 or 1500.50.")
    .transform((v) => (v === "" ? null : v)),
  priceUnit: z.enum(["FIXED", "HOURLY", "DAILY", "MONTHLY"]),
})

/** Catalog price used to pre-fill proposal and invoice lines. Blank means "price on request". */
export async function updateServicePrice(serviceId: string, input: { price: string; priceUnit: string }): Promise<Result> {
  const user = await requireSettingsWriter()
  const parsed = priceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid price." }
  const service = await db.service.update({ where: { id: serviceId }, data: parsed.data })
  await logEvent({
    actor: userActor(user),
    action: "service.update",
    entity: { type: "service", id: serviceId },
    metadata: { name: service.name, price: parsed.data.price, unit: parsed.data.priceUnit },
  })
  revalidatePath("/settings/services")
  return { ok: true }
}
