import type { ExpenseCategory, InvoiceStatus, PaymentMethod, ProposalStatus, ServicePriceUnit } from "@/lib/generated/prisma/enums"

import { currencies as currencyCodes } from "@/lib/leads/constants"

export { currencyCodes }
const currencyNames: Record<string, string> = { USD: "US Dollar", EUR: "Euro", GBP: "British Pound", PKR: "Pakistani Rupee", AED: "UAE Dirham" }
export const currencyItems = currencyCodes.map((c) => ({ value: c, label: `${c} · ${currencyNames[c] ?? c}` }))

export const priceUnitLabels: Record<ServicePriceUnit, string> = {
  FIXED: "fixed",
  HOURLY: "per hour",
  DAILY: "per day",
  MONTHLY: "per month",
}

/** Statuses shown in the UI, including the derived ones. */
export type InvoiceDisplayStatus = InvoiceStatus | "OVERDUE" | "PARTIAL"
export type ProposalDisplayStatus = ProposalStatus | "EXPIRED"

type Tone = "neutral" | "info" | "warning" | "success" | "brand" | "destructive"

export const invoiceStatusMeta: Record<InvoiceDisplayStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "Pending", tone: "info" },
  PARTIAL: { label: "Partly paid", tone: "warning" },
  OVERDUE: { label: "Overdue", tone: "destructive" },
  PAID: { label: "Paid", tone: "success" },
  VOID: { label: "Void", tone: "neutral" },
}

export const proposalStatusMeta: Record<ProposalDisplayStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "Sent", tone: "info" },
  ACCEPTED: { label: "Accepted", tone: "success" },
  DECLINED: { label: "Declined", tone: "destructive" },
  EXPIRED: { label: "Expired", tone: "warning" },
}

/** today: "YYYY-MM-DD" in the app time zone (lib/format dayKey). */
export function invoiceDisplayStatus(
  inv: { status: InvoiceStatus; dueDate: string; amountPaid: number },
  today: string
): InvoiceDisplayStatus {
  if (inv.status !== "SENT") return inv.status
  if (inv.dueDate < today) return "OVERDUE"
  if (inv.amountPaid > 0) return "PARTIAL"
  return "SENT"
}

export function proposalDisplayStatus(p: { status: ProposalStatus; validUntil: string | null }, today: string): ProposalDisplayStatus {
  if (p.status === "SENT" && p.validUntil && p.validUntil < today) return "EXPIRED"
  return p.status
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  CASH: "Cash",
  CHEQUE: "Cheque",
  ONLINE: "Online payment",
  OTHER: "Other",
}

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  SOFTWARE: "Software & subscriptions",
  HARDWARE: "Hardware",
  CONTRACTORS: "Contractors",
  MARKETING: "Marketing",
  OFFICE: "Office & utilities",
  TRAVEL: "Travel",
  TAXES_FEES: "Taxes & fees",
  OTHER: "Other",
}
