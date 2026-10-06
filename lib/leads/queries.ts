import "server-only"

import { cache } from "react"

import type { CurrentUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { endOfTodayInZone, startOfMonthInZone } from "@/lib/time"
import type { Prisma } from "@/lib/generated/prisma/client"
import { defaultServices, defaultStages, type LeadSourceKey } from "@/lib/leads/constants"
import type {
  BoardColumnDTO,
  LeadCardDTO,
  LeadDetailDTO,
  PersonDTO,
  ServiceDTO,
  StageDTO,
  TimelineItem,
} from "@/lib/leads/types"

// ─── Scoping ────────────────────────────────────────────────────────────────

export const getOrgSettings = cache(() =>
  db.orgSettings.upsert({ where: { id: "org" }, create: { id: "org" }, update: {} })
)

/**
 * The leads a user may see. Members see only their own leads when
 * "Members see only assigned work" is on. Every lead query must use this.
 */
export async function leadScope(user: CurrentUser): Promise<Prisma.LeadWhereInput> {
  if (user.role === "MEMBER" && (await getOrgSettings()).membersSeeAssignedOnly) {
    return { ownerId: user.id }
  }
  return {}
}

// ─── Reference data ─────────────────────────────────────────────────────────

export const getStages = cache(async (): Promise<StageDTO[]> => {
  let stages = await db.pipelineStage.findMany({ orderBy: { position: "asc" } })
  if (stages.length === 0) {
    // First run without the seed: create the defaults.
    await db.pipelineStage.createMany({ data: defaultStages.map((s, position) => ({ ...s, position })) })
    stages = await db.pipelineStage.findMany({ orderBy: { position: "asc" } })
  }
  return stages.map(({ id, name, kind, tone, position }) => ({ id, name, kind, tone, position }))
})

export const getServices = cache(async (options: { includeInactive?: boolean } = {}): Promise<ServiceDTO[]> => {
  if ((await db.service.count()) === 0) {
    await db.service.createMany({ data: defaultServices.map((name, position) => ({ name, position })) })
  }
  const services = await db.service.findMany({
    where: options.includeInactive ? {} : { active: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  })
  return services.map(({ id, name, description, active }) => ({ id, name, description, active }))
})

/** Active team members who can own leads. */
export const getAssignableMembers = cache(async (): Promise<PersonDTO[]> => {
  return db.user.findMany({
    where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MEMBER"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })
})

// ─── Board and list ─────────────────────────────────────────────────────────

export type LeadFilters = {
  q?: string
  ownerId?: string
  source?: LeadSourceKey
  stageId?: string
}

function filterWhere(filters: LeadFilters): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {}
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q } },
      { company: { contains: filters.q } },
      { email: { contains: filters.q } },
    ]
  }
  if (filters.ownerId === "none") where.ownerId = null
  else if (filters.ownerId) where.ownerId = filters.ownerId
  if (filters.source) where.source = filters.source
  if (filters.stageId) where.stageId = filters.stageId
  return where
}

const cardSelect = {
  id: true,
  name: true,
  company: true,
  value: true,
  currency: true,
  source: true,
  stageId: true,
  position: true,
  updatedAt: true,
  owner: { select: { id: true, name: true } },
  services: { select: { service: { select: { name: true } } } },
  reminders: {
    where: { completedAt: null },
    orderBy: { dueAt: "asc" },
    take: 1,
    select: { dueAt: true },
  },
} satisfies Prisma.LeadSelect

type CardRow = Prisma.LeadGetPayload<{ select: typeof cardSelect }>

function toCard(row: CardRow): LeadCardDTO {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    value: Number(row.value),
    currency: row.currency,
    source: row.source,
    stageId: row.stageId,
    position: row.position,
    owner: row.owner,
    services: row.services.map((s) => s.service.name),
    nextFollowUp: row.reminders[0]?.dueAt.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getBoard(user: CurrentUser, filters: LeadFilters): Promise<BoardColumnDTO[]> {
  const [stages, scope] = await Promise.all([getStages(), leadScope(user)])
  const rows = await db.lead.findMany({
    where: { AND: [scope, filterWhere(filters)] },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: cardSelect,
  })
  const cards = rows.map(toCard)
  return stages.map((stage) => ({ ...stage, leads: cards.filter((c) => c.stageId === stage.id) }))
}

export async function getLeadList(user: CurrentUser, filters: LeadFilters) {
  const scope = await leadScope(user)
  const rows = await db.lead.findMany({
    where: { AND: [scope, filterWhere(filters)] },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: cardSelect,
  })
  return rows.map(toCard)
}

// ─── Detail ─────────────────────────────────────────────────────────────────

export async function getLeadDetail(user: CurrentUser, id: string): Promise<LeadDetailDTO | null> {
  const scope = await leadScope(user)
  const lead = await db.lead.findFirst({
    where: { AND: [scope, { id }] },
    include: {
      stage: true,
      owner: { select: { id: true, name: true } },
      services: { select: { serviceId: true } },
      client: { select: { id: true, name: true } },
      reminders: {
        orderBy: [{ completedAt: { sort: "asc", nulls: "first" } }, { dueAt: "asc" }],
        include: { assignee: { select: { id: true, name: true } } },
      },
      notes: { orderBy: { occurredAt: "desc" }, take: 200 },
    },
  })
  if (!lead) return null

  const events = await db.event.findMany({
    where: { entityType: "lead", entityId: lead.id, action: { notIn: ["lead.note.create"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  const timeline: TimelineItem[] = [
    ...lead.notes.map((note) => ({
      kind: "note" as const,
      id: note.id,
      type: note.type,
      body: note.body,
      authorId: note.authorId,
      authorName: note.authorName,
      at: note.occurredAt.toISOString(),
    })),
    ...events.map((event) => ({
      kind: "event" as const,
      id: event.id,
      action: event.action,
      actorName: event.actorName,
      metadata: (event.metadata as Record<string, unknown> | null) ?? null,
      at: event.createdAt.toISOString(),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return {
    id: lead.id,
    name: lead.name,
    company: lead.company,
    email: lead.email,
    phone: lead.phone,
    website: lead.website,
    source: lead.source,
    value: Number(lead.value),
    currency: lead.currency,
    stage: { id: lead.stage.id, name: lead.stage.name, kind: lead.stage.kind, tone: lead.stage.tone, position: lead.stage.position },
    owner: lead.owner,
    serviceIds: lead.services.map((s) => s.serviceId),
    lostReason: lead.lostReason,
    lostDetail: lead.lostDetail,
    closedAt: lead.closedAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    client: lead.client,
    reminders: lead.reminders.map((r) => ({
      id: r.id,
      note: r.note,
      dueAt: r.dueAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      assignee: r.assignee,
    })),
    timeline,
  }
}

// ─── Dashboard and workload ─────────────────────────────────────────────────

export type MoneyTotals = Record<string, number>

function addMoney(totals: MoneyTotals, currency: string, value: number) {
  totals[currency] = (totals[currency] ?? 0) + value
}

export async function getPipelineSummary(user: CurrentUser) {
  const scope = await leadScope(user)
  const startOfMonth = startOfMonthInZone()

  const [open, wonThisMonth, lostThisMonth, newThisMonth] = await Promise.all([
    db.lead.findMany({ where: { AND: [scope, { stage: { kind: "OPEN" } }] }, select: { value: true, currency: true } }),
    db.lead.findMany({
      where: { AND: [scope, { stage: { kind: "WON" }, closedAt: { gte: startOfMonth } }] },
      select: { value: true, currency: true },
    }),
    db.lead.count({ where: { AND: [scope, { stage: { kind: "LOST" }, closedAt: { gte: startOfMonth } }] } }),
    db.lead.count({ where: { AND: [scope, { createdAt: { gte: startOfMonth } }] } }),
  ])

  const openValue: MoneyTotals = {}
  for (const lead of open) addMoney(openValue, lead.currency, Number(lead.value))
  const wonValue: MoneyTotals = {}
  for (const lead of wonThisMonth) addMoney(wonValue, lead.currency, Number(lead.value))

  const closed = wonThisMonth.length + lostThisMonth
  return {
    openCount: open.length,
    openValue,
    wonCount: wonThisMonth.length,
    wonValue,
    winRate: closed ? Math.round((wonThisMonth.length / closed) * 100) : null,
    newCount: newThisMonth,
  }
}

/** Open follow-ups assigned to the user that are due before the end of today. */
export async function getMyDueFollowUps(user: CurrentUser) {
  const endOfToday = endOfTodayInZone()
  const scope = await leadScope(user)
  const rows = await db.reminder.findMany({
    where: { assigneeId: user.id, completedAt: null, dueAt: { lte: endOfToday }, lead: scope },
    orderBy: { dueAt: "asc" },
    take: 20,
    include: { lead: { select: { id: true, name: true, company: true } } },
  })
  return rows.map((r) => ({
    id: r.id,
    note: r.note,
    dueAt: r.dueAt.toISOString(),
    lead: r.lead,
  }))
}

export async function getRecentLeads(user: CurrentUser, take = 6) {
  const scope = await leadScope(user)
  const rows = await db.lead.findMany({
    where: scope,
    orderBy: { updatedAt: "desc" },
    take,
    select: { ...cardSelect, stage: { select: { name: true, tone: true, kind: true } } },
  })
  return rows.map((row) => ({ ...toCard(row), stage: row.stage }))
}

export async function getWorkload() {
  const now = new Date()
  const members = await db.user.findMany({
    where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MEMBER"] } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      title: true,
      role: true,
      leadsOwned: { where: { stage: { kind: "OPEN" } }, select: { value: true, currency: true } },
      remindersAssigned: { where: { completedAt: null }, select: { dueAt: true } },
    },
  })
  const unassigned = await db.lead.count({ where: { ownerId: null, stage: { kind: "OPEN" } } })

  return {
    unassigned,
    members: members.map((m) => {
      const value: MoneyTotals = {}
      for (const lead of m.leadsOwned) addMoney(value, lead.currency, Number(lead.value))
      return {
        id: m.id,
        name: m.name,
        title: m.title,
        role: m.role,
        openLeads: m.leadsOwned.length,
        openValue: value,
        followUps: m.remindersAssigned.length,
        overdue: m.remindersAssigned.filter((r) => r.dueAt < now).length,
      }
    }),
  }
}
