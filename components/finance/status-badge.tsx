import { Badge } from "@/components/ui/badge"
import {
  invoiceStatusMeta,
  proposalStatusMeta,
  type InvoiceDisplayStatus,
  type ProposalDisplayStatus,
} from "@/lib/finance/constants"

function InvoiceStatusBadge({ status }: { status: InvoiceDisplayStatus }) {
  const meta = invoiceStatusMeta[status]
  return (
    <Badge variant={meta.tone} className="rounded-md">
      {meta.label}
    </Badge>
  )
}

function ProposalStatusBadge({ status }: { status: ProposalDisplayStatus }) {
  const meta = proposalStatusMeta[status]
  return (
    <Badge variant={meta.tone} className="rounded-md">
      {meta.label}
    </Badge>
  )
}

export { InvoiceStatusBadge, ProposalStatusBadge }
