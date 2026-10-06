import "server-only"

import type { CurrentUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { dayKey, parseDateOnly, toDateOnly } from "@/lib/format"
import type { Prisma } from "@/lib/generated/prisma/client"
import { getOrgSettings } from "@/lib/leads/queries"
import type { ProjectStatusKey } from "@/lib/projects/constants"
import type {
  MilestoneDTO,
  Progress,
  ProjectDetailDTO,
  ProjectSummaryDTO,
  TaskDTO,
} from "@/lib/projects/types"

// ─── Scoping ────────────────────────────────────────────────────────────────

/**
 * Projects a team user may see. Members only see projects they lead or belong to
 * when "Members see only assigned work" is on. Clients use clientProjectScope.
 */
export async function projectScope(user: CurrentUser): Promise<Prisma.ProjectWhereInput> {
  if (user.role === "CLIENT") return { clientId: user.clientId ?? "__none__" }
  if (user.role === "MEMBER" && (await getOrgSettings()).membersSeeAssignedOnly) {
    return { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] }
  }
  return {}
}

export function progressOf(done: number, total: number): Progress {
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 }
}

function todayDate() {
  return parseDateOnly(dayKey(new Date()))
}

// ─── Lists ──────────────────────────────────────────────────────────────────

export type ProjectFilters = { status?: ProjectStatusKey | "open"; clientId?: string; mine?: boolean }

const summarySelect = {
  id: true,
  name: true,
  status: true,
  startDate: true,
  dueDate: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  service: { select: { name: true } },
  owner: { select: { id: true, name: true } },
  tasks: { select: { status: true, dueDate: true } },
  milestones: {
    where: { completedAt: null },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { position: "asc" }],
    take: 1,
    select: { name: true, dueDate: true },
  },
} satisfies Prisma.ProjectSelect

type SummaryRow = Prisma.ProjectGetPayload<{ select: typeof summarySelect }>

function toSummary(row: SummaryRow): ProjectSummaryDTO {
  const today = todayDate()
  const done = row.tasks.filter((t) => t.status === "DONE").length
  const open = row.tasks.filter((t) => t.status !== "DONE")
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    client: row.client,
    service: row.service?.name ?? null,
    owner: row.owner,
    startDate: toDateOnly(row.startDate),
    dueDate: toDateOnly(row.dueDate),
    progress: progressOf(done, row.tasks.length),
    openTasks: open.length,
    overdueTasks: open.filter((t) => t.dueDate && t.dueDate < today).length,
    nextMilestone: row.milestones[0]
      ? { name: row.milestones[0].name, dueDate: toDateOnly(row.milestones[0].dueDate) }
      : null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getProjects(user: CurrentUser, filters: ProjectFilters = {}) {
  const where: Prisma.ProjectWhereInput[] = [await projectScope(user)]
  if (filters.status === "open") where.push({ status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } })
  else if (filters.status) where.push({ status: filters.status })
  if (filters.clientId) where.push({ clientId: filters.clientId })
  if (filters.mine) where.push({ OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] })

  const rows = await db.project.findMany({
    where: { AND: where },
    orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    select: summarySelect,
  })
  return rows.map(toSummary)
}

// ─── Detail ─────────────────────────────────────────────────────────────────

function toTask(t: Prisma.TaskGetPayload<{ include: { assignee: { select: { id: true; name: true } } } }>): TaskDTO {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assignee: t.assignee,
    milestoneId: t.milestoneId,
    dueDate: toDateOnly(t.dueDate),
    position: t.position,
    completedAt: t.completedAt?.toISOString() ?? null,
  }
}

export async function getProjectDetail(user: CurrentUser, id: string): Promise<ProjectDetailDTO | null> {
  const project = await db.project.findFirst({
    where: { AND: [await projectScope(user), { id }] },
    include: {
      client: { select: { id: true, name: true } },
      service: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      members: { include: { user: { select: { id: true, name: true } } }, orderBy: { addedAt: "asc" } },
      milestones: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      tasks: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: { assignee: { select: { id: true, name: true } } },
      },
    },
  })
  if (!project) return null

  const activity = await db.event.findMany({
    where: { entityType: "project", entityId: project.id },
    orderBy: { createdAt: "desc" },
    take: 60,
  })

  const tasks = project.tasks.map(toTask)
  const milestones: MilestoneDTO[] = project.milestones.map((m) => {
    const own = tasks.filter((t) => t.milestoneId === m.id)
    return {
      id: m.id,
      name: m.name,
      dueDate: toDateOnly(m.dueDate),
      completedAt: m.completedAt?.toISOString() ?? null,
      progress: progressOf(own.filter((t) => t.status === "DONE").length, own.length),
    }
  })

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    client: project.client,
    serviceId: project.service?.id ?? null,
    serviceName: project.service?.name ?? null,
    owner: project.owner,
    members: project.members.map((m) => m.user),
    startDate: toDateOnly(project.startDate),
    dueDate: toDateOnly(project.dueDate),
    completedAt: project.completedAt?.toISOString() ?? null,
    progress: progressOf(tasks.filter((t) => t.status === "DONE").length, tasks.length),
    milestones,
    tasks,
    activity: activity.map((e) => ({
      id: e.id,
      action: e.action,
      actorName: e.actorName,
      metadata: (e.metadata as Record<string, unknown> | null) ?? null,
      at: e.createdAt.toISOString(),
    })),
  }
}

// ─── Personal ───────────────────────────────────────────────────────────────

/** Open tasks assigned to the user, soonest deadline first. */
export async function getMyTasks(user: CurrentUser, take = 8) {
  const rows = await db.task.findMany({
    where: { assigneeId: user.id, status: { not: "DONE" }, project: await projectScope(user) },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "asc" }, { createdAt: "asc" }],
    take,
    include: { project: { select: { id: true, name: true } } },
  })
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: toDateOnly(t.dueDate),
    project: t.project,
  }))
}

/** Open task counts per team member, for the workload view. */
export async function getTaskLoad() {
  const today = todayDate()
  const [open, overdue] = await Promise.all([
    db.task.groupBy({ by: ["assigneeId"], where: { status: { not: "DONE" }, assigneeId: { not: null } }, _count: { _all: true } }),
    db.task.groupBy({
      by: ["assigneeId"],
      where: { status: { not: "DONE" }, assigneeId: { not: null }, dueDate: { lt: today } },
      _count: { _all: true },
    }),
  ])
  const result = new Map<string, { open: number; overdue: number }>()
  for (const row of open) if (row.assigneeId) result.set(row.assigneeId, { open: row._count._all, overdue: 0 })
  for (const row of overdue) {
    if (!row.assigneeId) continue
    const entry = result.get(row.assigneeId) ?? { open: 0, overdue: 0 }
    entry.overdue = row._count._all
    result.set(row.assigneeId, entry)
  }
  return result
}

// ─── Client portal (read-only, scoped to the client's own projects) ─────────

export async function getPortalProjects(clientId: string) {
  const rows = await db.project.findMany({
    where: { clientId, status: { not: "CANCELLED" } },
    orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }],
    select: summarySelect,
  })
  return rows.map(toSummary)
}

/** Portal view of one project: progress and milestones only, never internal task details. */
export async function getPortalProject(clientId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, clientId, status: { not: "CANCELLED" } },
    include: {
      owner: { select: { name: true } },
      service: { select: { name: true } },
      milestones: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      tasks: { select: { status: true, milestoneId: true } },
    },
  })
  if (!project) return null
  const done = project.tasks.filter((t) => t.status === "DONE").length
  return {
    id: project.id,
    name: project.name,
    // The brief is internal; it is deliberately not sent to clients.
    status: project.status,
    service: project.service?.name ?? null,
    lead: project.owner?.name ?? null,
    startDate: toDateOnly(project.startDate),
    dueDate: toDateOnly(project.dueDate),
    progress: progressOf(done, project.tasks.length),
    taskCounts: {
      todo: project.tasks.filter((t) => t.status === "TODO").length,
      doing: project.tasks.filter((t) => t.status === "DOING").length,
      done,
    },
    milestones: project.milestones.map((m) => {
      const own = project.tasks.filter((t) => t.milestoneId === m.id)
      return {
        id: m.id,
        name: m.name,
        dueDate: toDateOnly(m.dueDate),
        completedAt: m.completedAt?.toISOString() ?? null,
        progress: progressOf(own.filter((t) => t.status === "DONE").length, own.length),
      }
    }),
  }
}
