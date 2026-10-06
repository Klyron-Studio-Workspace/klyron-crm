import "server-only"

import {
  invoiceDisplayStatus,
  priceUnitLabels,
  proposalDisplayStatus,
  type InvoiceDisplayStatus,
  type ProposalDisplayStatus,
} from "@/lib/finance/constants"
import { addTo, computeTotals, fromCents, lineAmountCents, toCents } from "@/lib/finance/math"
import type {
  CatalogServiceDTO,
  ExpenseDTO,
  InvoiceDetailDTO,
  InvoiceSummaryDTO,
  LineItemDTO,
  ProposalDetailDTO,
  ProposalSummaryDTO,
  StudioDTO,
} from "@/lib/finance/types"
import { db } from "@/lib/db"
import { dayKey, toDateOnly } from "@/lib/format"
import type { Prisma } from "@/lib/generated/prisma/client"

const num = (d: Prisma.Decimal | number | null | undefined) => (d == null ? 0 : Number(d))
const ymd = (d: Date) => toDateOnly(d) as string
const iso = (d: Date | null) => d?.toISOString() ?? null
const dateOf = (ymdText: string) => new Date(`${ymdText}T00:00:00.000Z`)
export const todayKey = () => dayKey(new Date())

export async function getOrgBilling() {
  const org = await db.orgSettings.upsert({ where: { id: "org" }, create: { id: "org" }, update: {} })
  return {
    ...org,
    defaultTaxRate: num(org.defaultTaxRate),
    studio: {
      name: org.name,
      website: org.website,
      billingEmail: org.billingEmail,
      address: org.address,
      paymentInstructions: org.paymentInstructions,
    } satisfies StudioDTO,
  }
}

export async function getCatalog(): Promise<CatalogServiceDTO[]> {
  const services = await db.service.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { name: "asc" }] })
  return services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    price: s.price == null ? null : num(s.price),
    unitLabel: priceUnitLabels[s.priceUnit],
  }))
}

type ItemRow = { serviceId: string | null; description: string; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal }
function toItems(rows: ItemRow[]): LineItemDTO[] {
  return rows.map((r) => {
    const line = { quantity: num(r.quantity), unitPrice: num(r.unitPrice) }
    return { serviceId: r.serviceId, description: r.description, ...line, amount: fromCents(lineAmountCents(line)) }
  })
}

function totalsOf(items: LineItemDTO[], discount: Prisma.Decimal, taxRate: Prisma.Decimal) {
  return { ...computeTotals(items, num(discount), num(taxRate)), taxRate: num(taxRate) }
}

// ─── Invoices ───────────────────────────────────────────────────────────────

const invoiceSummaryInclude = {
  client: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
} satisfies Prisma.InvoiceInclude

type InvoiceSummaryRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceSummaryInclude }>

function toInvoiceSummary(inv: InvoiceSummaryRow, today: string): InvoiceSummaryDTO {
  const total = num(inv.total)
  const amountPaid = num(inv.amountPaid)
  const dueDate = ymd(inv.dueDate)
  return {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    displayStatus: invoiceDisplayStatus({ status: inv.status, dueDate, amountPaid }, today),
    client: { id: inv.client.id, name: inv.client.name },
    project: inv.project,
    currency: inv.currency,
    issueDate: ymd(inv.issueDate),
    dueDate,
    total,
    amountPaid,
    balance: inv.status === "SENT" ? fromCents(toCents(total) - toCents(amountPaid)) : 0,
    publicToken: inv.publicToken,
  }
}

export type InvoiceFilter = "all" | "open" | InvoiceDisplayStatus

function invoiceWhere(filter: InvoiceFilter, today: string): Prisma.InvoiceWhereInput {
  switch (filter) {
    case "all":
      return {}
    case "open":
      return { status: "SENT" }
    case "OVERDUE":
      return { status: "SENT", dueDate: { lt: dateOf(today) } }
    case "PARTIAL":
      return { status: "SENT", dueDate: { gte: dateOf(today) }, amountPaid: { gt: 0 } }
    case "SENT":
      return { status: "SENT", dueDate: { gte: dateOf(today) }, amountPaid: 0 }
    default:
      return { status: filter }
  }
}

export async function listInvoices(options: { filter?: InvoiceFilter; clientId?: string; projectId?: string } = {}) {
  const today = todayKey()
  const rows = await db.invoice.findMany({
    where: {
      ...invoiceWhere(options.filter ?? "all", today),
      ...(options.clientId ? { clientId: options.clientId } : {}),
      ...(options.projectId ? { projectId: options.projectId } : {}),
    },
    include: invoiceSummaryInclude,
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    take: 500,
  })
  return rows.map((r) => toInvoiceSummary(r, today))
}

const invoiceDetailInclude = {
  client: { select: { id: true, name: true, contactName: true, email: true } },
  project: { select: { id: true, name: true } },
  proposal: { select: { id: true, number: true } },
  createdBy: { select: { name: true } },
  items: { orderBy: { position: "asc" } },
  payments: { orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }], include: { recordedBy: { select: { name: true } } } },
} satisfies Prisma.InvoiceInclude

async function loadInvoice(where: Prisma.InvoiceWhereUniqueInput): Promise<InvoiceDetailDTO | null> {
  const inv = await db.invoice.findUnique({ where, include: invoiceDetailInclude })
  if (!inv) return null
  const items = toItems(inv.items)
  return {
    ...toInvoiceSummary(inv, todayKey()),
    notes: inv.notes,
    items,
    totals: totalsOf(items, inv.discount, inv.taxRate),
    billTo: { name: inv.client.name, contactName: inv.client.contactName, email: inv.client.email },
    payments: inv.payments.map((p) => ({
      id: p.id,
      amount: num(p.amount),
      paidOn: ymd(p.paidOn),
      method: p.method,
      reference: p.reference,
      note: p.note,
      recordedBy: p.recordedBy?.name ?? null,
    })),
    proposal: inv.proposal,
    sentAt: iso(inv.sentAt),
    viewedAt: iso(inv.viewedAt),
    paidAt: iso(inv.paidAt),
    lastReminderAt: iso(inv.lastReminderAt),
    reminderCount: inv.reminderCount,
    createdBy: inv.createdBy?.name ?? null,
    createdAt: inv.createdAt.toISOString(),
  }
}

export const getInvoice = (id: string) => loadInvoice({ id })
export const getInvoiceByToken = (publicToken: string) => loadInvoice({ publicToken })

// ─── Proposals ──────────────────────────────────────────────────────────────

const proposalSummaryInclude = {
  client: { select: { id: true, name: true, contactName: true, email: true } },
  lead: { select: { id: true, name: true, company: true, email: true } },
} satisfies Prisma.ProposalInclude

type ProposalSummaryRow = Prisma.ProposalGetPayload<{ include: typeof proposalSummaryInclude }>

function toProposalSummary(p: ProposalSummaryRow, today: string): ProposalSummaryDTO {
  const validUntil = p.validUntil ? ymd(p.validUntil) : null
  return {
    id: p.id,
    number: p.number,
    title: p.title,
    status: p.status,
    displayStatus: proposalDisplayStatus({ status: p.status, validUntil }, today),
    recipient: p.client
      ? { kind: "client", id: p.client.id, name: p.client.name }
      : p.lead
        ? { kind: "lead", id: p.lead.id, name: p.lead.company ?? p.lead.name }
        : null,
    currency: p.currency,
    issueDate: ymd(p.issueDate),
    validUntil,
    total: num(p.total),
    publicToken: p.publicToken,
  }
}

export type ProposalFilter = "all" | ProposalDisplayStatus

function proposalWhere(filter: ProposalFilter, today: string): Prisma.ProposalWhereInput {
  if (filter === "all") return {}
  if (filter === "EXPIRED") return { status: "SENT", validUntil: { lt: dateOf(today) } }
  if (filter === "SENT") return { status: "SENT", OR: [{ validUntil: null }, { validUntil: { gte: dateOf(today) } }] }
  return { status: filter }
}

export async function listProposals(options: { filter?: ProposalFilter; clientId?: string; leadId?: string } = {}) {
  const today = todayKey()
  const rows = await db.proposal.findMany({
    where: {
      ...proposalWhere(options.filter ?? "all", today),
      ...(options.clientId ? { clientId: options.clientId } : {}),
      ...(options.leadId ? { leadId: options.leadId } : {}),
    },
    include: proposalSummaryInclude,
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    take: 500,
  })
  return rows.map((r) => toProposalSummary(r, today))
}

async function loadProposal(where: Prisma.ProposalWhereUniqueInput): Promise<ProposalDetailDTO | null> {
  const p = await db.proposal.findUnique({
    where,
    include: {
      ...proposalSummaryInclude,
      createdBy: { select: { name: true } },
      items: { orderBy: { position: "asc" } },
      invoices: { select: { id: true, number: true }, orderBy: { createdAt: "asc" } },
    },
  })
  if (!p) return null
  const items = toItems(p.items)
  return {
    ...toProposalSummary(p, todayKey()),
    introduction: p.introduction,
    terms: p.terms,
    items,
    totals: totalsOf(items, p.discount, p.taxRate),
    billTo: p.client
      ? { name: p.client.name, contactName: p.client.contactName, email: p.client.email }
      : { name: p.lead?.company ?? p.lead?.name ?? "—", contactName: p.lead?.company ? p.lead.name : null, email: p.lead?.email ?? null },
    sentAt: iso(p.sentAt),
    viewedAt: iso(p.viewedAt),
    respondedAt: iso(p.respondedAt),
    responseNote: p.responseNote,
    invoices: p.invoices,
    createdBy: p.createdBy?.name ?? null,
    createdAt: p.createdAt.toISOString(),
  }
}

export const getProposal = (id: string) => loadProposal({ id })
export const getProposalByToken = (publicToken: string) => loadProposal({ publicToken })

// ─── Expenses ───────────────────────────────────────────────────────────────

export async function listExpenses(options: { from?: string; to?: string } = {}): Promise<ExpenseDTO[]> {
  const rows = await db.expense.findMany({
    where: {
      spentOn: {
        ...(options.from ? { gte: dateOf(options.from) } : {}),
        ...(options.to ? { lte: dateOf(options.to) } : {}),
      },
    },
    include: { client: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
    orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }],
    take: 1000,
  })
  return rows.map((e) => ({
    id: e.id,
    spentOn: ymd(e.spentOn),
    amount: num(e.amount),
    currency: e.currency,
    category: e.category,
    vendor: e.vendor,
    description: e.description,
    client: e.client,
    project: e.project,
  }))
}

// ─── Overview ───────────────────────────────────────────────────────────────

export type MonthPoint = { month: string; revenue: number; expenses: number }

/** Last `months` calendar months ("YYYY-MM"), oldest first, ending with the current one. */
export function monthKeys(today: string, months: number) {
  const [y, m] = today.split("-").map(Number)
  return Array.from({ length: months }, (_, i) => new Date(Date.UTC(y, m - 1 - (months - 1 - i), 1)).toISOString().slice(0, 7))
}

const plus = (a: number, b: number) => fromCents(toCents(a) + toCents(b))

export async function getFinanceOverview(currency: string) {
  const today = todayKey()
  const months = monthKeys(today, 12)
  const from = dateOf(`${months[0]}-01`)
  const thisMonth = today.slice(0, 7)
  const yearStart = `${today.slice(0, 4)}-01`

  const [payments, expenses, open, proposals] = await Promise.all([
    db.payment.findMany({
      where: { paidOn: { gte: from }, invoice: { status: { not: "VOID" } } },
      select: { amount: true, paidOn: true, invoice: { select: { currency: true, client: { select: { id: true, name: true } } } } },
    }),
    db.expense.findMany({ where: { spentOn: { gte: from } }, select: { amount: true, currency: true, spentOn: true } }),
    listInvoices({ filter: "open" }),
    db.proposal.findMany({ where: { status: "SENT" }, select: { total: true, currency: true, validUntil: true } }),
  ])

  const series: MonthPoint[] = months.map((month) => ({ month, revenue: 0, expenses: 0 }))
  const byMonth = new Map(series.map((p) => [p.month, p]))
  const collectedThisMonth: Record<string, number> = {}
  const expensesThisMonth: Record<string, number> = {}
  const clientTotals = new Map<string, { id: string; name: string; totals: Record<string, number> }>()

  for (const p of payments) {
    const key = ymd(p.paidOn).slice(0, 7)
    const amount = num(p.amount)
    const point = byMonth.get(key)
    if (point && p.invoice.currency === currency) point.revenue = plus(point.revenue, amount)
    if (key === thisMonth) addTo(collectedThisMonth, p.invoice.currency, amount)
    if (key >= yearStart) {
      const c = clientTotals.get(p.invoice.client.id) ?? { ...p.invoice.client, totals: {} }
      addTo(c.totals, p.invoice.currency, amount)
      clientTotals.set(c.id, c)
    }
  }
  for (const e of expenses) {
    const key = ymd(e.spentOn).slice(0, 7)
    const amount = num(e.amount)
    const point = byMonth.get(key)
    if (point && e.currency === currency) point.expenses = plus(point.expenses, amount)
    if (key === thisMonth) addTo(expensesThisMonth, e.currency, amount)
  }

  const outstanding: Record<string, number> = {}
  const overdue: Record<string, number> = {}
  for (const inv of open) {
    addTo(outstanding, inv.currency, inv.balance)
    if (inv.displayStatus === "OVERDUE") addTo(overdue, inv.currency, inv.balance)
  }
  const pipeline: Record<string, number> = {}
  let pipelineCount = 0
  for (const p of proposals) {
    if (p.validUntil && ymd(p.validUntil) < today) continue
    addTo(pipeline, p.currency, num(p.total))
    pipelineCount++
  }

  const net: Record<string, number> = { ...collectedThisMonth }
  for (const [c, v] of Object.entries(expensesThisMonth)) addTo(net, c, -v)

  const topClients = [...clientTotals.values()]
    .sort((a, b) => (b.totals[currency] ?? 0) - (a.totals[currency] ?? 0))
    .slice(0, 5)

  return {
    series,
    collectedThisMonth,
    expensesThisMonth,
    net,
    outstanding,
    overdue,
    overdueInvoices: open.filter((i) => i.displayStatus === "OVERDUE").sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    openCount: open.length,
    pipeline,
    pipelineCount,
    topClients,
  }
}

/** Billing summary for one client (client page and portal). Drafts are team-only. */
export async function getClientBilling(clientId: string, options: { includeDrafts: boolean }) {
  const [invoices, proposals] = await Promise.all([listInvoices({ clientId }), listProposals({ clientId })])
  const outstanding: Record<string, number> = {}
  for (const inv of invoices) if (inv.status === "SENT") addTo(outstanding, inv.currency, inv.balance)
  return {
    invoices: options.includeDrafts ? invoices : invoices.filter((i) => i.status !== "DRAFT"),
    proposals: options.includeDrafts ? proposals : proposals.filter((p) => p.status !== "DRAFT"),
    outstanding,
  }
}
