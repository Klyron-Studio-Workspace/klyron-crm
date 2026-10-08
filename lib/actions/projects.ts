"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { echo, fieldErrorsFrom, type FormState } from "@/lib/actions/state"
import { allowAiRequest } from "@/lib/ai/rate-limit"
import { logEvent, userActor } from "@/lib/audit"
import { can, requireTeamUser, type CurrentUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { parseDateOnly } from "@/lib/format"
import { getOrgSettings } from "@/lib/leads/queries"
import {
  projectStatuses,
  projectStatusLabels,
  taskPriorities,
  taskStatuses,
  taskStatusLabels,
  type TaskStatusKey,
} from "@/lib/projects/constants"
import { projectScope } from "@/lib/projects/queries"
import { generateProjectInsights, isProjectAiConfigured, type ProjectInsights } from "@/lib/projects/ai"
import { notify } from "@/lib/notifications"

type Result = { ok: true; message?: string } | { ok: false; error: string }
type InsightResult = { ok: true; insights: ProjectInsights } | { ok: false; error: string }

async function requireProjectWriter() {
  const user = await requireTeamUser()
  if (!(await can(user, "projects", "WRITE"))) throw new Error("You don't have permission to edit projects.")
  return user
}

async function findScopedProject(user: CurrentUser, projectId: string) {
  return db.project.findFirst({ where: { AND: [await projectScope(user), { id: projectId }] } })
}

function revalidateProject(projectId: string, clientId?: string) {
  revalidatePath("/projects")
  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/")
  revalidatePath("/team")
  revalidatePath("/portal", "layout")
  if (clientId) revalidatePath(`/clients/${clientId}`)
}

const dateField = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a valid date.")
  .transform((v) => (v ? parseDateOnly(v) : null))

const nullableId = z.string().transform((v) => (v && v !== "none" ? v : null))

async function activeTeamIds(ids: string[]) {
  if (ids.length === 0) return []
  const users = await db.user.findMany({
    where: { id: { in: ids }, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MEMBER"] } },
    select: { id: true },
  })
  return users.map((u) => u.id)
}

// ─── Projects ───────────────────────────────────────────────────────────────

const projectSchema = z
  .object({
    name: z.string().trim().min(1, "Name the project.").max(120),
    description: z
      .string()
      .trim()
      .max(20_000)
      .transform((v) => v || null),
    clientId: z.string().min(1, "Choose a client."),
    serviceId: nullableId,
    ownerId: nullableId,
    status: z.enum(projectStatuses),
    startDate: dateField,
    dueDate: dateField,
  })
  .refine((v) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate, {
    path: ["dueDate"],
    message: "The deadline is before the start date.",
  })

const PROJECT_ECHO = ["name", "description", "clientId", "serviceId", "ownerId", "status", "startDate", "dueDate"]

function memberIdsFrom(formData: FormData) {
  return [...new Set(formData.getAll("memberIds").map(String).filter(Boolean))]
}

/** Members who only see assigned work must stay on the projects they touch. */
async function includeSelfIfScoped(user: CurrentUser, ownerId: string | null, memberIds: string[]) {
  if (user.role !== "MEMBER" || !(await getOrgSettings()).membersSeeAssignedOnly) return memberIds
  if (ownerId === user.id || memberIds.includes(user.id)) return memberIds
  return [...memberIds, user.id]
}

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireProjectWriter()
  const values = { ...echo(formData, PROJECT_ECHO), memberIds: memberIdsFrom(formData).join(",") }
  const parsed = projectSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const data = parsed.data

  if (!(await db.client.findUnique({ where: { id: data.clientId } }))) return { fieldErrors: { clientId: ["Client not found."] }, values }
  const [owner] = data.ownerId ? await activeTeamIds([data.ownerId]) : [null]
  if (data.ownerId && !owner) return { fieldErrors: { ownerId: ["Choose an active team member."] }, values }
  const memberIds = await includeSelfIfScoped(user, data.ownerId, await activeTeamIds(memberIdsFrom(formData)))

  const project = await db.project.create({
    data: {
      ...data,
      completedAt: data.status === "COMPLETED" ? new Date() : null,
      members: { create: memberIds.map((userId) => ({ userId })) },
    },
  })
  await logEvent({
    actor: userActor(user),
    action: "project.create",
    entity: { type: "project", id: project.id },
    metadata: { name: project.name, clientId: project.clientId },
  })
  await notify({
    userIds: [...memberIds, ...(data.ownerId ? [data.ownerId] : [])],
    excludeUserId: user.id,
    type: "project.added",
    title: `${user.name} added you to ${project.name}`,
    link: `/projects/${project.id}`,
  })
  await logEvent({
    actor: userActor(user),
    action: "client.project.create",
    entity: { type: "client", id: project.clientId },
    metadata: { projectId: project.id, name: project.name },
  })
  revalidateProject(project.id, project.clientId)
  redirect(`/projects/${project.id}`)
}

export async function updateProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireProjectWriter()
  const projectId = String(formData.get("projectId") ?? "")
  const values = { ...echo(formData, PROJECT_ECHO), memberIds: memberIdsFrom(formData).join(",") }
  const parsed = projectSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const data = parsed.data

  const existing = await findScopedProject(user, projectId)
  if (!existing) return { error: "Project not found.", values }
  if (!(await db.client.findUnique({ where: { id: data.clientId } }))) return { fieldErrors: { clientId: ["Client not found."] }, values }
  const [owner] = data.ownerId ? await activeTeamIds([data.ownerId]) : [null]
  if (data.ownerId && !owner) return { fieldErrors: { ownerId: ["Choose an active team member."] }, values }
  const memberIds = await includeSelfIfScoped(user, data.ownerId, await activeTeamIds(memberIdsFrom(formData)))
  const previousMemberIds = (await db.projectMember.findMany({ where: { projectId }, select: { userId: true } })).map((m) => m.userId)

  await db.$transaction([
    db.project.update({
      where: { id: projectId },
      data: {
        ...data,
        completedAt: data.status === "COMPLETED" ? (existing.completedAt ?? new Date()) : null,
      },
    }),
    db.projectMember.deleteMany({ where: { projectId, userId: { notIn: memberIds } } }),
    db.projectMember.createMany({ data: memberIds.map((userId) => ({ projectId, userId })), skipDuplicates: true }),
  ])

  const changed = (["name", "description", "clientId", "serviceId", "ownerId", "status", "startDate", "dueDate"] as const).filter(
    (key) => String(existing[key]?.valueOf() ?? "") !== String(data[key]?.valueOf() ?? "")
  )
  if (existing.status !== data.status) {
    await logEvent({
      actor: userActor(user),
      action: "project.status",
      entity: { type: "project", id: projectId },
      metadata: { from: projectStatusLabels[existing.status], to: projectStatusLabels[data.status] },
    })
  }
  const newlyAdded = memberIds.filter((id) => !previousMemberIds.includes(id))
  const newLead = data.ownerId && data.ownerId !== existing.ownerId ? [data.ownerId] : []
  await notify({
    userIds: [...newlyAdded, ...newLead],
    excludeUserId: user.id,
    type: "project.added",
    title: `${user.name} added you to ${data.name}`,
    link: `/projects/${projectId}`,
  })
  const otherFields = changed.filter((f) => f !== "status")
  if (otherFields.length) {
    await logEvent({ actor: userActor(user), action: "project.update", entity: { type: "project", id: projectId }, metadata: { fields: otherFields } })
  }
  revalidateProject(projectId, data.clientId)
  if (existing.clientId !== data.clientId) revalidatePath(`/clients/${existing.clientId}`)
  return { ok: true, message: "Project updated." }
}

export async function setProjectStatus(projectId: string, status: string): Promise<Result> {
  const user = await requireProjectWriter()
  const parsed = z.enum(projectStatuses).safeParse(status)
  if (!parsed.success) return { ok: false, error: "Invalid status." }
  const project = await findScopedProject(user, projectId)
  if (!project) return { ok: false, error: "Project not found." }
  if (project.status === parsed.data) return { ok: true }

  await db.project.update({
    where: { id: projectId },
    data: { status: parsed.data, completedAt: parsed.data === "COMPLETED" ? new Date() : null },
  })
  await logEvent({
    actor: userActor(user),
    action: "project.status",
    entity: { type: "project", id: projectId },
    metadata: { from: projectStatusLabels[project.status], to: projectStatusLabels[parsed.data] },
  })
  revalidateProject(projectId, project.clientId)
  return { ok: true }
}

export async function deleteProject(projectId: string): Promise<Result> {
  const user = await requireProjectWriter()
  if (user.role === "MEMBER") return { ok: false, error: "Only Owners and Admins can delete projects." }
  const project = await findScopedProject(user, projectId)
  if (!project) return { ok: false, error: "Project not found." }

  await db.project.delete({ where: { id: projectId } })
  await logEvent({
    actor: userActor(user),
    action: "project.delete",
    entity: { type: "client", id: project.clientId },
    metadata: { name: project.name },
  })
  revalidateProject(projectId, project.clientId)
  redirect("/projects")
}

// ─── Milestones ─────────────────────────────────────────────────────────────

const milestoneSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1, "Name the milestone.").max(120),
  dueDate: dateField,
})

export async function addMilestone(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireProjectWriter()
  const values = echo(formData, ["name", "dueDate"])
  const parsed = milestoneSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const { projectId, name, dueDate } = parsed.data
  const project = await findScopedProject(user, projectId)
  if (!project) return { error: "Project not found.", values }

  const last = await db.milestone.findFirst({ where: { projectId }, orderBy: { position: "desc" }, select: { position: true } })
  await db.milestone.create({ data: { projectId, name, dueDate, position: (last?.position ?? 0) + 1 } })
  await logEvent({ actor: userActor(user), action: "milestone.create", entity: { type: "project", id: projectId }, metadata: { name } })
  revalidateProject(projectId, project.clientId)
  return { ok: true }
}

async function loadMilestone(user: CurrentUser, milestoneId: string) {
  const milestone = await db.milestone.findUnique({ where: { id: milestoneId } })
  if (!milestone) return null
  const project = await findScopedProject(user, milestone.projectId)
  return project ? { milestone, project } : null
}

export async function updateMilestone(milestoneId: string, input: { name: string; dueDate: string }): Promise<Result> {
  const user = await requireProjectWriter()
  const parsed = z.object({ name: milestoneSchema.shape.name, dueDate: dateField }).safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid milestone." }
  const loaded = await loadMilestone(user, milestoneId)
  if (!loaded) return { ok: false, error: "Milestone not found." }

  await db.milestone.update({ where: { id: milestoneId }, data: parsed.data })
  revalidateProject(loaded.project.id, loaded.project.clientId)
  return { ok: true }
}

export async function setMilestoneDone(milestoneId: string, done: boolean): Promise<Result> {
  const user = await requireProjectWriter()
  const loaded = await loadMilestone(user, milestoneId)
  if (!loaded) return { ok: false, error: "Milestone not found." }

  await db.milestone.update({ where: { id: milestoneId }, data: { completedAt: done ? new Date() : null } })
  if (done) {
    await logEvent({
      actor: userActor(user),
      action: "milestone.complete",
      entity: { type: "project", id: loaded.project.id },
      metadata: { name: loaded.milestone.name },
    })
  }
  revalidateProject(loaded.project.id, loaded.project.clientId)
  return { ok: true }
}

export async function deleteMilestone(milestoneId: string): Promise<Result> {
  const user = await requireProjectWriter()
  const loaded = await loadMilestone(user, milestoneId)
  if (!loaded) return { ok: false, error: "Milestone not found." }
  await db.milestone.delete({ where: { id: milestoneId } }) // tasks keep existing, unlinked
  await logEvent({
    actor: userActor(user),
    action: "milestone.delete",
    entity: { type: "project", id: loaded.project.id },
    metadata: { name: loaded.milestone.name },
  })
  revalidateProject(loaded.project.id, loaded.project.clientId)
  return { ok: true }
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

async function endPosition(projectId: string, status: TaskStatusKey) {
  const last = await db.task.findFirst({
    where: { projectId, status },
    orderBy: { position: "desc" },
    select: { position: true },
  })
  return (last?.position ?? 0) + 1
}

const quickTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1, "Give the task a title.").max(200),
  status: z.enum(taskStatuses).default("TODO"),
})

/** Inline "Add task" on the board: title only. */
export async function quickAddTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireProjectWriter()
  const parsed = quickTaskSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, echo(formData, ["title"]))
  const { projectId, title, status } = parsed.data
  const project = await findScopedProject(user, projectId)
  if (!project) return { error: "Project not found." }

  await db.task.create({
    data: {
      projectId,
      title,
      status,
      position: await endPosition(projectId, status),
      createdById: user.id,
      completedAt: status === "DONE" ? new Date() : null,
    },
  })
  await logEvent({ actor: userActor(user), action: "task.create", entity: { type: "project", id: projectId }, metadata: { title } })
  revalidateProject(projectId, project.clientId)
  return { ok: true }
}

const taskSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(1, "Give the task a title.").max(200),
  description: z
    .string()
    .trim()
    .max(20_000)
    .transform((v) => v || null),
  status: z.enum(taskStatuses),
  priority: z.enum(taskPriorities),
  assigneeId: nullableId,
  milestoneId: nullableId,
  dueDate: dateField,
})

export async function updateTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireProjectWriter()
  const values = echo(formData, ["title", "description", "status", "priority", "assigneeId", "milestoneId", "dueDate"])
  const parsed = taskSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const { taskId, ...data } = parsed.data

  const task = await db.task.findUnique({ where: { id: taskId } })
  const project = task ? await findScopedProject(user, task.projectId) : null
  if (!task || !project) return { error: "Task not found.", values }
  if (data.assigneeId && (await activeTeamIds([data.assigneeId])).length === 0) {
    return { fieldErrors: { assigneeId: ["Choose an active team member."] }, values }
  }
  if (data.milestoneId && !(await db.milestone.findFirst({ where: { id: data.milestoneId, projectId: task.projectId } }))) {
    return { fieldErrors: { milestoneId: ["Choose a milestone from this project."] }, values }
  }

  const statusChanged = task.status !== data.status
  await db.task.update({
    where: { id: taskId },
    data: {
      ...data,
      ...(statusChanged
        ? { position: await endPosition(task.projectId, data.status), completedAt: data.status === "DONE" ? new Date() : null }
        : {}),
    },
  })
  if (statusChanged) {
    await logEvent({
      actor: userActor(user),
      action: "task.status",
      entity: { type: "project", id: task.projectId },
      metadata: { title: data.title, from: taskStatusLabels[task.status], to: taskStatusLabels[data.status] },
    })
  }
  if (task.assigneeId !== data.assigneeId) {
    const assignee = data.assigneeId ? await db.user.findUnique({ where: { id: data.assigneeId }, select: { name: true } }) : null
    await logEvent({
      actor: userActor(user),
      action: "task.assign",
      entity: { type: "project", id: task.projectId },
      metadata: { title: data.title, to: assignee?.name ?? "Unassigned" },
    })
    if (data.assigneeId) {
      await notify({
        userIds: [data.assigneeId],
        excludeUserId: user.id,
        type: "task.assigned",
        title: `${user.name} assigned you “${data.title}”`,
        body: `In ${project.name}${data.dueDate ? `, due ${data.dueDate.toISOString().slice(0, 10)}` : ""}`,
        link: `/projects/${project.id}`,
      })
    }
  }
  revalidateProject(task.projectId, project.clientId)
  return { ok: true, message: "Task saved." }
}

/** Fractional position before another task (drag and drop), renumbering the column if gaps run out. */
async function positionBefore(projectId: string, status: TaskStatusKey, beforeTaskId: string | null, movingId: string) {
  if (!beforeTaskId) return endPosition(projectId, status)
  const before = await db.task.findFirst({ where: { id: beforeTaskId, projectId, status }, select: { position: true } })
  if (!before) return endPosition(projectId, status)
  const prev = await db.task.findFirst({
    where: { projectId, status, position: { lt: before.position }, id: { not: movingId } },
    orderBy: { position: "desc" },
    select: { position: true },
  })
  const lower = prev?.position ?? before.position - 1
  if (before.position - lower > 1e-6) return (lower + before.position) / 2

  const column = await db.task.findMany({
    where: { projectId, status, id: { not: movingId } },
    orderBy: { position: "asc" },
    select: { id: true },
  })
  let target = 0
  await db.$transaction(
    column.map((row, index) => {
      if (row.id === beforeTaskId) target = index + 0.5
      return db.task.update({ where: { id: row.id }, data: { position: index + 1 } })
    })
  )
  return target
}

export async function moveTask(taskId: string, status: string, beforeTaskId: string | null = null): Promise<Result> {
  const user = await requireProjectWriter()
  const parsedStatus = z.enum(taskStatuses).safeParse(status)
  if (!parsedStatus.success) return { ok: false, error: "Invalid status." }
  const task = await db.task.findUnique({ where: { id: taskId } })
  const project = task ? await findScopedProject(user, task.projectId) : null
  if (!task || !project) return { ok: false, error: "Task not found." }

  const position = await positionBefore(task.projectId, parsedStatus.data, beforeTaskId, taskId)
  const changed = task.status !== parsedStatus.data
  await db.task.update({
    where: { id: taskId },
    data: {
      status: parsedStatus.data,
      position,
      ...(changed ? { completedAt: parsedStatus.data === "DONE" ? new Date() : null } : {}),
    },
  })
  if (changed) {
    await logEvent({
      actor: userActor(user),
      action: "task.status",
      entity: { type: "project", id: task.projectId },
      metadata: { title: task.title, from: taskStatusLabels[task.status], to: taskStatusLabels[parsedStatus.data] },
    })
  }
  revalidateProject(task.projectId, project.clientId)
  return { ok: true }
}

export async function deleteTask(taskId: string): Promise<Result> {
  const user = await requireProjectWriter()
  const task = await db.task.findUnique({ where: { id: taskId } })
  const project = task ? await findScopedProject(user, task.projectId) : null
  if (!task || !project) return { ok: false, error: "Task not found." }
  await db.task.delete({ where: { id: taskId } })
  await logEvent({ actor: userActor(user), action: "task.delete", entity: { type: "project", id: task.projectId }, metadata: { title: task.title } })
  revalidateProject(task.projectId, project.clientId)
  return { ok: true }
}

// ─── AI assistance ─────────────────────────────────────────────────────────

export async function analyzeProject(projectId: string): Promise<InsightResult> {
  const user = await requireTeamUser()
  if (!(await can(user, "projects", "READ"))) return { ok: false, error: "You don't have permission to view projects." }
  const project = await findScopedProject(user, projectId)
  if (!project) return { ok: false, error: "Project not found." }
  if (!isProjectAiConfigured()) return { ok: false, error: "Add GROQ_API_KEY to .env first." }
  if (!allowAiRequest(user.id)) return { ok: false, error: "You've generated several AI summaries. Wait a minute and try again." }

  try {
    return { ok: true, insights: await generateProjectInsights(project.id) }
  } catch (error) {
    console.error("[project-ai] analysis failed:", error instanceof Error ? error.message : error)
    return { ok: false, error: "The AI service couldn't summarize this project. Try again in a moment." }
  }
}
