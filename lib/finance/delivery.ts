import "server-only"

import { hasAccess, isTeamRole } from "@/lib/auth/permissions"
import { getAccess } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { formatDateOnly, toDateOnly } from "@/lib/format"
import { sendMail } from "@/lib/mail"
import { formatMoney } from "@/lib/money"
import { appUrl } from "@/lib/request"

/** Active team members whose role can edit Finance (Owner and Admin by default). */
export async function financeAudience() {
  const users = await db.user.findMany({
    where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MEMBER"] } },
    select: { id: true, role: true },
  })
  const allowed = new Map<string, boolean>()
  const ids: string[] = []
  for (const user of users) {
    if (!isTeamRole(user.role)) continue
    if (!allowed.has(user.role)) allowed.set(user.role, hasAccess(await getAccess(user.role, "finance"), "WRITE"))
    if (allowed.get(user.role)) ids.push(user.id)
  }
  return ids
}

/** Where client documents are emailed: the client's billing email plus their active portal logins. */
export async function clientRecipients(clientId: string) {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { email: true, accounts: { where: { status: "ACTIVE" }, select: { email: true } } },
  })
  if (!client) return []
  return [...new Set([client.email, ...client.accounts.map((a) => a.email)].filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase()))]
}

async function studioName() {
  const org = await db.orgSettings.findUnique({ where: { id: "org" }, select: { name: true } })
  return org?.name ?? "Klyron Studio"
}

async function sendToAll(to: string[], mail: Omit<Parameters<typeof sendMail>[0], "to">) {
  const results = await Promise.all(to.map((address) => sendMail({ ...mail, to: address })))
  return results.filter(Boolean).length
}

export async function emailInvoice(invoiceId: string, kind: "new" | "reminder") {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, include: { client: { select: { name: true, contactName: true } } } })
  if (!invoice) return { recipients: 0 }
  const to = await clientRecipients(invoice.clientId)
  if (to.length === 0) return { recipients: 0 }

  const studio = await studioName()
  const balance = Number(invoice.total) - Number(invoice.amountPaid)
  const amount = formatMoney(balance, invoice.currency)
  const due = formatDateOnly(toDateOnly(invoice.dueDate)!)
  const greeting = `Hi ${invoice.client.contactName?.split(" ")[0] ?? invoice.client.name},`
  const text =
    kind === "new"
      ? `${greeting}\n\n${studio} has sent you invoice ${invoice.number} for ${amount}, due ${due}.\n\nYou can view, download or print it at the link below.`
      : `${greeting}\n\nThis is a friendly reminder that invoice ${invoice.number} for ${amount} was due on ${due} and is still open.\n\nIf you've already paid, thank you, and please ignore this message.`
  await sendToAll(to, {
    subject: kind === "new" ? `Invoice ${invoice.number} from ${studio}` : `Reminder: invoice ${invoice.number} is overdue`,
    text,
    action: { label: "View invoice", url: appUrl(`/i/${invoice.publicToken}`) },
  })
  return { recipients: to.length }
}

export async function emailProposal(proposalId: string) {
  const proposal = await db.proposal.findUnique({
    where: { id: proposalId },
    include: { client: { select: { name: true, contactName: true } }, lead: { select: { name: true, email: true } } },
  })
  if (!proposal) return { recipients: 0 }
  const to = proposal.clientId ? await clientRecipients(proposal.clientId) : proposal.lead?.email ? [proposal.lead.email] : []
  if (to.length === 0) return { recipients: 0 }

  const studio = await studioName()
  const name = proposal.client?.contactName ?? proposal.client?.name ?? proposal.lead?.name ?? ""
  const validity = proposal.validUntil ? ` It's valid until ${formatDateOnly(toDateOnly(proposal.validUntil)!)}.` : ""
  await sendToAll(to, {
    subject: `Proposal from ${studio}: ${proposal.title}`,
    text: `Hi ${name.split(" ")[0]},\n\n${studio} has prepared a proposal for you: “${proposal.title}” (${formatMoney(Number(proposal.total), proposal.currency)}).${validity}\n\nYou can review it and accept or decline online.`,
    action: { label: "Review proposal", url: appUrl(`/p/${proposal.publicToken}`) },
  })
  return { recipients: to.length }
}
