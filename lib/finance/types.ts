import type { InvoiceDisplayStatus, ProposalDisplayStatus } from "@/lib/finance/constants"
import type {
  ExpenseCategory,
  InvoiceStatus,
  PaymentMethod,
  ProposalStatus,
} from "@/lib/generated/prisma/enums"

export type LineItemDTO = {
  serviceId: string | null
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

export type TotalsDTO = { subtotal: number; discount: number; taxRate: number; tax: number; total: number }

/** Studio details printed on documents. */
export type StudioDTO = {
  name: string
  website: string | null
  billingEmail: string | null
  address: string | null
  paymentInstructions: string | null
  signatureSvg: string | null
}

export type BillToDTO = { name: string; contactName: string | null; email: string | null }

export type InvoiceSummaryDTO = {
  id: string
  number: string
  status: InvoiceStatus
  displayStatus: InvoiceDisplayStatus
  client: { id: string; name: string }
  project: { id: string; name: string } | null
  currency: string
  issueDate: string
  dueDate: string
  total: number
  amountPaid: number
  balance: number
  /** Secret link token: /i/<token> */
  publicToken: string
}

export type PaymentDTO = {
  id: string
  amount: number
  paidOn: string
  method: PaymentMethod
  reference: string | null
  note: string | null
  recordedBy: string | null
}

export type InvoiceDetailDTO = InvoiceSummaryDTO & {
  notes: string | null
  items: LineItemDTO[]
  totals: TotalsDTO
  billTo: BillToDTO
  payments: PaymentDTO[]
  proposal: { id: string; number: string } | null
  sentAt: string | null
  viewedAt: string | null
  paidAt: string | null
  lastReminderAt: string | null
  reminderCount: number
  createdBy: string | null
  createdAt: string
}

export type ProposalRecipient = { kind: "client" | "lead"; id: string; name: string }

export type ProposalSummaryDTO = {
  id: string
  number: string
  title: string
  status: ProposalStatus
  displayStatus: ProposalDisplayStatus
  recipient: ProposalRecipient | null
  currency: string
  issueDate: string
  validUntil: string | null
  total: number
  /** Secret link token: /p/<token> */
  publicToken: string
}

export type ProposalDetailDTO = ProposalSummaryDTO & {
  introduction: string | null
  terms: string | null
  items: LineItemDTO[]
  totals: TotalsDTO
  billTo: BillToDTO
  sentAt: string | null
  viewedAt: string | null
  respondedAt: string | null
  responseNote: string | null
  invoices: { id: string; number: string }[]
  createdBy: string | null
  createdAt: string
}

export type ExpenseDTO = {
  id: string
  spentOn: string
  amount: number
  currency: string
  category: ExpenseCategory
  vendor: string | null
  description: string
  client: { id: string; name: string } | null
  project: { id: string; name: string } | null
}

/** What the document editor needs for services. */
export type CatalogServiceDTO = { id: string; name: string; description: string | null; price: number | null; unitLabel: string }
