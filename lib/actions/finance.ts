"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { echo, fieldErrorsFrom, type FormState } from "@/lib/actions/state"
import { logEvent, systemActor, userActor } from "@/lib/audit"
import { can, getCurrentUser, requireTeamUser } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import { generateToken } from "@/lib/auth/tokens"
import { db } from "@/lib/db"
import { currencyCodes } from "@/lib/finance/constants"
import { emailInvoice, emailProposal, financeAudience } from "@/lib/finance/delivery"
import { computeTotals, fromCents, toCents } from "@/lib/finance/math"
import { todayKey } from "@/lib/finance/queries"
import { parseDateOnly } from "@/lib/format"
import type { Prisma } from "@/lib/generated/prisma/client"
import { notify } from "@/lib/notifications"

/** Exact amounts (cents included) for messages about balances. */
const formatMoney = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

type Result = { ok: true; message?: string } | { ok: false; error: string }

async function requireFinanceWriter() {
  const user = await requireTeamUser()
  if (!(await can(user, "finance", "WRITE"))) throw new Error("You don't have permission to edit finance records.")
  return user
}

function revalidateFinance(...paths: string[]) {
  revalidatePath("/finance", "layout")
  for (const path of paths) revalidatePath(path)
}

const money = (value: number) => value.toFixed(2)

// ─── Shared validation ──────────────────────────────────────────────────────

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.")
const optionalYmd = z.union([z.literal(""), ymd]).transform((v) => v || null)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null)
const amount = (label: string, max = 1e10) =>
  z.coerce.number({ error: `Enter ${label}.` }).min(0, `${label[0].toUpperCase()}${label.slice(1)} can't be negative.`).max(max)

const itemSchema = z.object({
  serviceId: z.string().nullable().optional(),
  description: z.string().trim().min(1, "Every line needs a description.").max(500),
  quantity: z.coerce.number().positive("Quantities must be more than zero.").max(1_000_000),
  unitPrice: z.coerce.number().min(0, "Prices can't be negative.").max(1e10),
})

const itemsField = z.string().transform((raw, ctx) => {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    ctx.addIssue({ code: "custom", message: "Add at least one line item." })
    return z.NEVER
  }
  const parsed = z.array(itemSchema).min(1, "Add at least one line item.").max(100).safeParse(data)
  if (!parsed.success) {
    ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "Check the line items." })
    return z.NEVER
  }
  return parsed.data
})

const documentFields = {
  currency: z.enum(currencyCodes),
  issueDate: ymd,
  discount: amount("a discount").default(0),
  taxRate: amount("a tax rate", 100).default(0),
  items: itemsField,
}

type Item = z.infer<typeof itemSchema>

async function itemRows(items: Item[]) {
  const ids = [...new Set(items.map((i) => i.serviceId).filter((id): id is string => Boolean(id)))]
  const valid = new Set((await db.service.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((s) => s.id))
  return items.map((item, position) => ({
    serviceId: item.serviceId && valid.has(item.serviceId) ? item.serviceId : null,
    description: item.description,
    quantity: item.quantity.toFixed(2),
    unitPrice: money(item.unitPrice),
    position,
  }))
}

function totalsFor(items: Item[], discount: number, taxRate: number) {
  const totals = computeTotals(items, discount, taxRate)
  return { subtotal: money(totals.subtotal), discount: money(totals.discount), taxRate: taxRate.toFixed(2), total: money(totals.total) }
}

/** Next document number, e.g. INV-0007. The counter only ever goes up. */
async function nextNumber(tx: Prisma.TransactionClient, kind: "invoice" | "proposal") {
  await tx.orgSettings.upsert({ where: { id: "org" }, create: { id: "org" }, update: {} })
  const org = await tx.orgSettings.update({
    where: { id: "org" },
    data: kind === "invoice" ? { invoiceSeq: { increment: 1 } } : { proposalSeq: { increment: 1 } },
  })
  const seq = kind === "invoice" ? org.invoiceSeq : org.proposalSeq
  const prefix = kind === "invoice" ? org.invoicePrefix : org.proposalPrefix
  return `${prefix}-${String(seq).padStart(4, "0")}`
}

const ITEM_ECHO = ["currency", "issueDate", "discount", "taxRate", "items"]

// ─── Invoices ───────────────────────────────────────────────────────────────

const invoiceSchema = z
  .object({
    ...documentFields,
    clientId: z.string().min(1, "Choose a client."),
    projectId: z.string().transform((v) => (v && v !== "none" ? v : null)),
    proposalId: z.string().optional().transform((v) => v || null),
    dueDate: ymd,
    notes: optionalText(5000),
  })
  .refine((v) => v.dueDate >= v.issueDate, { path: ["dueDate"], message: "The due date can't be before the issue date." })

const INVOICE_ECHO = [...ITEM_ECHO, "clientId", "projectId", "proposalId", "dueDate", "notes"]

export async function saveInvoice(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireFinanceWriter()
  const values = echo(formData, INVOICE_ECHO)
  const invoiceId = String(formData.get("invoiceId") ?? "")
  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const { items, clientId, projectId, proposalId, currency, issueDate, dueDate, discount, taxRate, notes } = parsed.data

  if (!(await db.client.findUnique({ where: { id: clientId }, select: { id: true } }))) {
    return { fieldErrors: { clientId: ["Choose a client."] }, values }
  }
  if (projectId && !(await db.project.findFirst({ where: { id: projectId, clientId }, select: { id: true } }))) {
    return { fieldErrors: { projectId: ["That project belongs to a different client."] }, values }
  }

  const totals = totalsFor(items, discount, taxRate)
  const rows = await itemRows(items)
  const data = {
    clientId,
    projectId,
    currency,
    issueDate: parseDateOnly(issueDate),
    dueDate: parseDateOnly(dueDate),
    notes,
    ...totals,
  }

  if (invoiceId) {
    const existing = await db.invoice.findUnique({ where: { id: invoiceId } })
    if (!existing) return { error: "Invoice not found.", values }
    if (existing.status === "PAID" || existing.status === "VOID") return { error: "Paid and void invoices can't be edited.", values }
    if (toCents(Number(totals.total)) < toCents(Number(existing.amountPaid))) {
      return { error: `The new total is less than the ${formatMoney(Number(existing.amountPaid), existing.currency)} already paid.`, values }
    }
    if (Number(existing.amountPaid) > 0 && currency !== existing.currency) {
      return { fieldErrors: { currency: ["The currency can't change after a payment is recorded."] }, values }
    }
    await db.$transaction([
      db.invoiceItem.deleteMany({ where: { invoiceId } }),
      db.invoice.update({ where: { id: invoiceId }, data: { ...data, items: { create: rows } } }),
    ])
    await logEvent({ actor: userActor(user), action: "invoice.update", entity: { type: "invoice", id: invoiceId }, metadata: { number: existing.number, total: totals.total } })
    revalidateFinance(`/finance/invoices/${invoiceId}`)
    redirect(`/finance/invoices/${invoiceId}`)
  }

  const validProposal = proposalId ? await db.proposal.findFirst({ where: { id: proposalId, clientId }, select: { id: true } }) : null
  const invoice = await db.$transaction(async (tx) =>
    tx.invoice.create({
      data: {
        ...data,
        number: await nextNumber(tx, "invoice"),
        proposalId: validProposal?.id ?? null,
        publicToken: generateToken(24),
        createdById: user.id,
        items: { create: rows },
      },
    })
  )
  await logEvent({ actor: userActor(user), action: "invoice.create", entity: { type: "invoice", id: invoice.id }, metadata: { number: invoice.number, total: totals.total } })
  await logEvent({ actor: userActor(user), action: "client.invoice.create", entity: { type: "client", id: clientId }, metadata: { number: invoice.number } })
  revalidateFinance(`/clients/${clientId}`)
  redirect(`/finance/invoices/${invoice.id}`)
}

/** Marks a draft as sent and, when `email` is on, emails the client a link. */
export async function sendInvoice(invoiceId: string, options: { email: boolean }): Promise<Result> {
  const user = await requireFinanceWriter()
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return { ok: false, error: "Invoice not found." }
  if (invoice.status === "VOID") return { ok: false, error: "This invoice is void." }

  if (invoice.status === "DRAFT") {
    await db.invoice.update({ where: { id: invoiceId }, data: { status: "SENT", sentAt: new Date() } })
  }
  let recipients = 0
  if (options.email) {
    recipients = (await emailInvoice(invoiceId, "new")).recipients
    if (recipients === 0) {
      revalidateFinance(`/finance/invoices/${invoiceId}`)
      return { ok: false, error: "Marked as sent, but this client has no email address or portal login to send it to." }
    }
  }
  await logEvent({
    actor: userActor(user),
    action: options.email ? "invoice.send" : "invoice.mark_sent",
    entity: { type: "invoice", id: invoiceId },
    metadata: { number: invoice.number, recipients },
  })
  revalidateFinance(`/finance/invoices/${invoiceId}`, `/clients/${invoice.clientId}`)
  return { ok: true, message: options.email ? `Emailed ${invoice.number} to ${recipients} ${recipients === 1 ? "address" : "addresses"}.` : `${invoice.number} marked as sent.` }
}

export async function sendPaymentReminder(invoiceId: string): Promise<Result> {
  const user = await requireFinanceWriter()
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice || invoice.status !== "SENT") return { ok: false, error: "Only open invoices can be chased." }
  const { recipients } = await emailInvoice(invoiceId, "reminder")
  if (recipients === 0) return { ok: false, error: "This client has no email address or portal login." }
  await db.invoice.update({ where: { id: invoiceId }, data: { lastReminderAt: new Date(), reminderCount: { increment: 1 } } })
  await logEvent({ actor: userActor(user), action: "invoice.reminder", entity: { type: "invoice", id: invoiceId }, metadata: { number: invoice.number, recipients } })
  revalidateFinance(`/finance/invoices/${invoiceId}`)
  return { ok: true, message: "Reminder sent." }
}

export async function voidInvoice(invoiceId: string): Promise<Result> {
  const user = await requireFinanceWriter()
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return { ok: false, error: "Invoice not found." }
  if (invoice.status === "PAID") return { ok: false, error: "Paid invoices can't be voided. Remove the payments first." }
  await db.invoice.update({ where: { id: invoiceId }, data: { status: "VOID", voidedAt: new Date() } })
  await logEvent({ actor: userActor(user), action: "invoice.void", entity: { type: "invoice", id: invoiceId }, metadata: { number: invoice.number } })
  revalidateFinance(`/finance/invoices/${invoiceId}`, `/clients/${invoice.clientId}`)
  return { ok: true, message: `${invoice.number} is void.` }
}

/** Only drafts can be deleted; anything the client has seen is voided instead. */
export async function deleteInvoice(invoiceId: string): Promise<Result> {
  const user = await requireFinanceWriter()
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return { ok: false, error: "Invoice not found." }
  if (invoice.status !== "DRAFT") return { ok: false, error: "Only drafts can be deleted. Void a sent invoice instead." }
  await db.invoice.delete({ where: { id: invoiceId } })
  await logEvent({ actor: userActor(user), action: "invoice.delete", entity: { type: "invoice", id: invoiceId }, metadata: { number: invoice.number } })
  revalidateFinance(`/clients/${invoice.clientId}`)
  redirect("/finance/invoices")
}

// ─── Payments ───────────────────────────────────────────────────────────────

const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number({ error: "Enter the amount received." }).positive("Enter the amount received.").max(1e10),
  paidOn: ymd,
  method: z.enum(["BANK_TRANSFER", "CARD", "CASH", "CHEQUE", "ONLINE", "OTHER"]),
  reference: optionalText(120),
  note: optionalText(500),
})

/** Recomputes amountPaid from the payment rows and settles the status. */
async function settle(tx: Prisma.TransactionClient, invoiceId: string) {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: { select: { amount: true } } } })
  const paidCents = invoice.payments.reduce((sum, p) => sum + toCents(Number(p.amount)), 0)
  const fullyPaid = paidCents >= toCents(Number(invoice.total)) && toCents(Number(invoice.total)) > 0
  const status = invoice.status === "VOID" ? "VOID" : fullyPaid ? "PAID" : invoice.status === "PAID" || invoice.status === "DRAFT" ? "SENT" : invoice.status
  return tx.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: money(fromCents(paidCents)),
      status,
      paidAt: status === "PAID" ? (invoice.paidAt ?? new Date()) : null,
      sentAt: invoice.sentAt ?? new Date(),
    },
  })
}

export async function recordPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireFinanceWriter()
  const values = echo(formData, ["amount", "paidOn", "method", "reference", "note"])
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const { invoiceId, amount: paid, paidOn, method, reference, note } = parsed.data

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return { error: "Invoice not found.", values }
  if (invoice.status === "VOID" || invoice.status === "PAID") return { error: `This invoice is ${invoice.status === "VOID" ? "void" : "already paid"}.`, values }
  const balanceCents = toCents(Number(invoice.total)) - toCents(Number(invoice.amountPaid))
  if (toCents(paid) > balanceCents) {
    return { fieldErrors: { amount: [`That's more than the ${formatMoney(fromCents(balanceCents), invoice.currency)} still owed.`] }, values }
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.payment.create({ data: { invoiceId, amount: money(paid), paidOn: parseDateOnly(paidOn), method, reference, note, recordedById: user.id } })
    return settle(tx, invoiceId)
  })
  await logEvent({
    actor: userActor(user),
    action: "invoice.payment",
    entity: { type: "invoice", id: invoiceId },
    metadata: { number: invoice.number, amount: money(paid), currency: invoice.currency, paid: updated.status === "PAID" },
  })
  if (updated.status === "PAID") {
    await notify({
      userIds: await financeAudience(),
      excludeUserId: user.id,
      type: "invoice.paid",
      title: `${invoice.number} is paid in full`,
      body: formatMoney(Number(invoice.total), invoice.currency),
      link: `/finance/invoices/${invoiceId}`,
      email: "never",
    })
  }
  revalidateFinance(`/finance/invoices/${invoiceId}`, `/clients/${invoice.clientId}`)
  return { ok: true, message: updated.status === "PAID" ? "Payment recorded. The invoice is paid in full." : "Payment recorded." }
}

export async function deletePayment(paymentId: string): Promise<Result> {
  const user = await requireFinanceWriter()
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { invoice: { select: { id: true, number: true, currency: true, clientId: true } } } })
  if (!payment) return { ok: false, error: "Payment not found." }
  await db.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: paymentId } })
    await settle(tx, payment.invoiceId)
  })
  await logEvent({
    actor: userActor(user),
    action: "invoice.payment.delete",
    entity: { type: "invoice", id: payment.invoiceId },
    metadata: { number: payment.invoice.number, amount: money(Number(payment.amount)), currency: payment.invoice.currency },
  })
  revalidateFinance(`/finance/invoices/${payment.invoiceId}`, `/clients/${payment.invoice.clientId}`)
  return { ok: true, message: "Payment removed." }
}

// ─── Proposals ──────────────────────────────────────────────────────────────

const proposalSchema = z
  .object({
    ...documentFields,
    recipient: z.string().regex(/^(client|lead):.+$/, "Choose who this proposal is for."),
    title: z.string().trim().min(1, "Give the proposal a title.").max(160),
    validUntil: optionalYmd,
    introduction: optionalText(10_000),
    terms: optionalText(10_000),
  })
  .refine((v) => !v.validUntil || v.validUntil >= v.issueDate, { path: ["validUntil"], message: "This must be after the issue date." })

const PROPOSAL_ECHO = [...ITEM_ECHO, "recipient", "title", "validUntil", "introduction", "terms"]

export async function saveProposal(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireFinanceWriter()
  const values = echo(formData, PROPOSAL_ECHO)
  const proposalId = String(formData.get("proposalId") ?? "")
  const parsed = proposalSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const { items, recipient, title, currency, issueDate, validUntil, discount, taxRate, introduction, terms } = parsed.data

  const [kind, recipientId] = recipient.split(":") as ["client" | "lead", string]
  const exists =
    kind === "client"
      ? await db.client.findUnique({ where: { id: recipientId }, select: { id: true } })
      : await db.lead.findUnique({ where: { id: recipientId }, select: { id: true } })
  if (!exists) return { fieldErrors: { recipient: ["Choose who this proposal is for."] }, values }

  const totals = totalsFor(items, discount, taxRate)
  const rows = await itemRows(items)
  const data = {
    title,
    clientId: kind === "client" ? recipientId : null,
    leadId: kind === "lead" ? recipientId : null,
    currency,
    issueDate: parseDateOnly(issueDate),
    validUntil: validUntil ? parseDateOnly(validUntil) : null,
    introduction,
    terms,
    ...totals,
  }

  if (proposalId) {
    const existing = await db.proposal.findUnique({ where: { id: proposalId } })
    if (!existing) return { error: "Proposal not found.", values }
    if (existing.status === "ACCEPTED" || existing.status === "DECLINED") return { error: "Answered proposals can't be edited.", values }
    await db.$transaction([
      db.proposalItem.deleteMany({ where: { proposalId } }),
      db.proposal.update({ where: { id: proposalId }, data: { ...data, items: { create: rows } } }),
    ])
    await logEvent({ actor: userActor(user), action: "proposal.update", entity: { type: "proposal", id: proposalId }, metadata: { number: existing.number, total: totals.total } })
    revalidateFinance(`/finance/proposals/${proposalId}`)
    redirect(`/finance/proposals/${proposalId}`)
  }

  const proposal = await db.$transaction(async (tx) =>
    tx.proposal.create({
      data: { ...data, number: await nextNumber(tx, "proposal"), publicToken: generateToken(24), createdById: user.id, items: { create: rows } },
    })
  )
  await logEvent({ actor: userActor(user), action: "proposal.create", entity: { type: "proposal", id: proposal.id }, metadata: { number: proposal.number, title, total: totals.total } })
  if (kind === "lead") {
    await logEvent({ actor: userActor(user), action: "lead.proposal.create", entity: { type: "lead", id: recipientId }, metadata: { number: proposal.number, title } })
  } else {
    await logEvent({ actor: userActor(user), action: "client.proposal.create", entity: { type: "client", id: recipientId }, metadata: { number: proposal.number, title } })
  }
  revalidateFinance(kind === "lead" ? `/leads/${recipientId}` : `/clients/${recipientId}`)
  redirect(`/finance/proposals/${proposal.id}`)
}

export async function sendProposal(proposalId: string, options: { email: boolean }): Promise<Result> {
  const user = await requireFinanceWriter()
  const proposal = await db.proposal.findUnique({ where: { id: proposalId } })
  if (!proposal) return { ok: false, error: "Proposal not found." }
  if (proposal.status === "ACCEPTED" || proposal.status === "DECLINED") return { ok: false, error: "This proposal has already been answered." }

  if (proposal.status === "DRAFT") await db.proposal.update({ where: { id: proposalId }, data: { status: "SENT", sentAt: new Date() } })
  let recipients = 0
  if (options.email) {
    recipients = (await emailProposal(proposalId)).recipients
    if (recipients === 0) {
      revalidateFinance(`/finance/proposals/${proposalId}`)
      return { ok: false, error: "Marked as sent, but there's no email address to send it to. Share the link instead." }
    }
  }
  await logEvent({
    actor: userActor(user),
    action: options.email ? "proposal.send" : "proposal.mark_sent",
    entity: { type: "proposal", id: proposalId },
    metadata: { number: proposal.number, recipients },
  })
  revalidateFinance(`/finance/proposals/${proposalId}`)
  return { ok: true, message: options.email ? `Emailed ${proposal.number} to ${recipients} ${recipients === 1 ? "address" : "addresses"}.` : `${proposal.number} marked as sent.` }
}

/** Team records an answer given outside the CRM (call, email). */
export async function setProposalOutcome(proposalId: string, outcome: "ACCEPTED" | "DECLINED"): Promise<Result> {
  const user = await requireFinanceWriter()
  const proposal = await db.proposal.findUnique({ where: { id: proposalId } })
  if (!proposal) return { ok: false, error: "Proposal not found." }
  if (proposal.status !== "SENT") return { ok: false, error: "Only sent proposals can be marked accepted or declined." }
  await db.proposal.update({ where: { id: proposalId }, data: { status: outcome, respondedAt: new Date() } })
  await logEvent({ actor: userActor(user), action: outcome === "ACCEPTED" ? "proposal.accept" : "proposal.decline", entity: { type: "proposal", id: proposalId }, metadata: { number: proposal.number, by: "team" } })
  revalidateFinance(`/finance/proposals/${proposalId}`)
  return { ok: true, message: `Marked as ${outcome === "ACCEPTED" ? "accepted" : "declined"}.` }
}

export async function deleteProposal(proposalId: string): Promise<Result> {
  const user = await requireFinanceWriter()
  const proposal = await db.proposal.findUnique({ where: { id: proposalId } })
  if (!proposal) return { ok: false, error: "Proposal not found." }
  if (proposal.status !== "DRAFT") return { ok: false, error: "Only drafts can be deleted." }
  await db.proposal.delete({ where: { id: proposalId } })
  await logEvent({ actor: userActor(user), action: "proposal.delete", entity: { type: "proposal", id: proposalId }, metadata: { number: proposal.number } })
  revalidateFinance()
  redirect("/finance/proposals")
}

/** Starts a draft invoice with the proposal's lines. The proposal must be for a client. */
export async function invoiceFromProposal(proposalId: string): Promise<Result> {
  const user = await requireFinanceWriter()
  const proposal = await db.proposal.findUnique({ where: { id: proposalId }, include: { items: { orderBy: { position: "asc" } } } })
  if (!proposal) return { ok: false, error: "Proposal not found." }
  if (!proposal.clientId) return { ok: false, error: "Convert the lead to a client first, then point this proposal at the client." }
  const clientId = proposal.clientId

  const org = await db.orgSettings.findUnique({ where: { id: "org" } })
  const today = todayKey()
  const due = new Date(parseDateOnly(today).getTime() + (org?.paymentTermsDays ?? 14) * 86_400_000)
  const invoice = await db.$transaction(async (tx) =>
    tx.invoice.create({
      data: {
        number: await nextNumber(tx, "invoice"),
        clientId,
        proposalId,
        currency: proposal.currency,
        issueDate: parseDateOnly(today),
        dueDate: due,
        discount: proposal.discount,
        taxRate: proposal.taxRate,
        subtotal: proposal.subtotal,
        total: proposal.total,
        publicToken: generateToken(24),
        createdById: user.id,
        items: {
          create: proposal.items.map((i) => ({ serviceId: i.serviceId, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, position: i.position })),
        },
      },
    })
  )
  await logEvent({ actor: userActor(user), action: "invoice.create", entity: { type: "invoice", id: invoice.id }, metadata: { number: invoice.number, fromProposal: proposal.number } })
  await logEvent({ actor: userActor(user), action: "client.invoice.create", entity: { type: "client", id: clientId }, metadata: { number: invoice.number } })
  revalidateFinance(`/finance/proposals/${proposalId}`, `/clients/${clientId}`)
  redirect(`/finance/invoices/${invoice.id}`)
}

/** Points a lead's proposal at the client the lead became, so it can be invoiced. */
export async function moveProposalToClient(proposalId: string): Promise<Result> {
  const user = await requireFinanceWriter()
  const proposal = await db.proposal.findUnique({ where: { id: proposalId }, include: { lead: { select: { client: { select: { id: true, name: true } } } } } })
  const client = proposal?.lead?.client
  if (!proposal || !client) return { ok: false, error: "This lead hasn't been converted to a client yet." }
  await db.proposal.update({ where: { id: proposalId }, data: { clientId: client.id } })
  await logEvent({ actor: userActor(user), action: "proposal.update", entity: { type: "proposal", id: proposalId }, metadata: { number: proposal.number, client: client.name } })
  revalidateFinance(`/finance/proposals/${proposalId}`, `/clients/${client.id}`)
  return { ok: true, message: `Moved to ${client.name}.` }
}

// ─── Public proposal answer (no account; the secret link is the credential) ──

const responseSchema = z.object({
  token: z.string().min(16).max(64),
  decision: z.enum(["ACCEPTED", "DECLINED"]),
  name: z.string().trim().min(1, "Type your name to confirm.").max(120),
  note: optionalText(1000),
})

export async function respondToProposal(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = echo(formData, ["name", "note"])
  const parsed = responseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const { token, decision, name, note } = parsed.data

  const proposal = await db.proposal.findUnique({ where: { publicToken: token } })
  if (!proposal) return { error: "This proposal link isn't valid.", values }
  if (proposal.status !== "SENT") return { error: "This proposal has already been answered.", values }
  if (proposal.validUntil && proposal.validUntil.toISOString().slice(0, 10) < todayKey()) {
    return { error: "This proposal has expired. Please contact us for an updated one.", values }
  }

  const viewer = await getCurrentUser()
  if (viewer && isTeamRole(viewer.role)) return { error: "Team members can't answer on the client's behalf. Use “Mark accepted” in the CRM.", values }

  const claimed = await db.proposal.updateMany({
    where: { id: proposal.id, status: "SENT" },
    data: { status: decision, respondedAt: new Date(), responseNote: [`${name}`, note].filter(Boolean).join(": ").slice(0, 1000) },
  })
  if (claimed.count === 0) return { error: "This proposal has already been answered.", values }

  const accepted = decision === "ACCEPTED"
  await logEvent({
    actor: viewer ? userActor(viewer) : { ...systemActor, name },
    action: accepted ? "proposal.accept" : "proposal.decline",
    entity: { type: "proposal", id: proposal.id },
    metadata: { number: proposal.number, by: "recipient", name },
  })
  await notify({
    userIds: [...new Set([...(await financeAudience()), ...(proposal.createdById ? [proposal.createdById] : [])])],
    type: accepted ? "proposal.accepted" : "proposal.declined",
    title: `${name} ${accepted ? "accepted" : "declined"} ${proposal.number}`,
    body: note ? `“${proposal.title}”: ${note}` : `“${proposal.title}”`,
    link: `/finance/proposals/${proposal.id}`,
    email: "always",
  })
  revalidateFinance(`/finance/proposals/${proposal.id}`)
  revalidatePath(`/p/${token}`)
  return { ok: true, message: accepted ? "Thank you! We've let the team know you accepted." : "Thanks for letting us know. The team has been told." }
}

// ─── Expenses ───────────────────────────────────────────────────────────────

const expenseSchema = z.object({
  spentOn: ymd,
  amount: z.coerce.number({ error: "Enter the amount." }).positive("Enter the amount.").max(1e10),
  currency: z.enum(currencyCodes),
  category: z.enum(["SOFTWARE", "HARDWARE", "CONTRACTORS", "MARKETING", "OFFICE", "TRAVEL", "TAXES_FEES", "OTHER"]),
  vendor: optionalText(120),
  description: z.string().trim().min(1, "Describe the expense.").max(500),
  clientId: z.string().transform((v) => (v && v !== "none" ? v : null)),
  projectId: z.string().transform((v) => (v && v !== "none" ? v : null)),
})

const EXPENSE_ECHO = ["spentOn", "amount", "currency", "category", "vendor", "description", "clientId", "projectId"]

export async function saveExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireFinanceWriter()
  const values = echo(formData, EXPENSE_ECHO)
  const expenseId = String(formData.get("expenseId") ?? "")
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const { spentOn, amount: spent, clientId, projectId, ...rest } = parsed.data

  let resolvedClientId = clientId
  if (projectId) {
    const project = await db.project.findUnique({ where: { id: projectId }, select: { clientId: true } })
    if (!project) return { fieldErrors: { projectId: ["Choose a project."] }, values }
    if (clientId && project.clientId !== clientId) return { fieldErrors: { projectId: ["That project belongs to a different client."] }, values }
    resolvedClientId = project.clientId
  } else if (clientId && !(await db.client.findUnique({ where: { id: clientId }, select: { id: true } }))) {
    return { fieldErrors: { clientId: ["Choose a client."] }, values }
  }

  const data = { ...rest, spentOn: parseDateOnly(spentOn), amount: money(spent), clientId: resolvedClientId, projectId }
  if (expenseId) {
    const existing = await db.expense.findUnique({ where: { id: expenseId }, select: { id: true } })
    if (!existing) return { error: "Expense not found.", values }
    await db.expense.update({ where: { id: expenseId }, data })
    await logEvent({ actor: userActor(user), action: "expense.update", entity: { type: "expense", id: expenseId }, metadata: { description: rest.description, amount: money(spent), currency: rest.currency } })
  } else {
    const expense = await db.expense.create({ data: { ...data, createdById: user.id } })
    await logEvent({ actor: userActor(user), action: "expense.create", entity: { type: "expense", id: expense.id }, metadata: { description: rest.description, amount: money(spent), currency: rest.currency } })
  }
  revalidateFinance()
  return { ok: true, message: expenseId ? "Expense updated." : "Expense added." }
}

export async function deleteExpense(expenseId: string): Promise<Result> {
  const user = await requireFinanceWriter()
  const expense = await db.expense.findUnique({ where: { id: expenseId } })
  if (!expense) return { ok: false, error: "Expense not found." }
  await db.expense.delete({ where: { id: expenseId } })
  await logEvent({ actor: userActor(user), action: "expense.delete", entity: { type: "expense", id: expenseId }, metadata: { description: expense.description, amount: money(Number(expense.amount)), currency: expense.currency } })
  revalidateFinance()
  return { ok: true, message: "Expense deleted." }
}

// ─── Billing settings ───────────────────────────────────────────────────────

const billingSchema = z.object({
  address: optionalText(1000),
  paymentInstructions: optionalText(2000),
  defaultTaxRate: amount("a tax rate", 100),
  paymentTermsDays: z.coerce.number().int("Use whole days.").min(0).max(365),
  invoicePrefix: z.string().trim().min(1, "Enter a prefix.").max(10).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only."),
  proposalPrefix: z.string().trim().min(1, "Enter a prefix.").max(10).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only."),
  autoPaymentReminders: z.literal("on").optional(),
})

export async function updateBillingSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireTeamUser()
  if (!(await can(user, "settings", "WRITE")) || !(await can(user, "finance", "WRITE"))) {
    return { error: "You don't have permission to change billing settings." }
  }
  const values = echo(formData, ["address", "paymentInstructions", "defaultTaxRate", "paymentTermsDays", "invoicePrefix", "proposalPrefix", "autoPaymentReminders"])
  const parsed = billingSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)
  const data = {
    ...parsed.data,
    defaultTaxRate: parsed.data.defaultTaxRate.toFixed(2),
    invoicePrefix: parsed.data.invoicePrefix.toUpperCase(),
    proposalPrefix: parsed.data.proposalPrefix.toUpperCase(),
    autoPaymentReminders: parsed.data.autoPaymentReminders === "on",
  }
  await db.orgSettings.upsert({ where: { id: "org" }, create: { id: "org", ...data }, update: data })
  await logEvent({ actor: userActor(user), action: "settings.billing.update" })
  revalidatePath("/settings/billing")
  return { ok: true, message: "Billing settings saved." }
}
