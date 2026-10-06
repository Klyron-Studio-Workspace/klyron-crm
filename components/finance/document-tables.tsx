import Link from "next/link"

import { formatAmount } from "@/components/finance/document-view"
import { InvoiceStatusBadge, ProposalStatusBadge } from "@/components/finance/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateOnly } from "@/lib/format"
import type { InvoiceSummaryDTO, ProposalSummaryDTO } from "@/lib/finance/types"

const rowLink =
  "font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"

function InvoiceTable({
  invoices,
  hrefFor,
  showClient = true,
  containerClassName,
}: {
  invoices: InvoiceSummaryDTO[]
  hrefFor: (invoice: InvoiceSummaryDTO) => string
  showClient?: boolean
  containerClassName?: string
}) {
  return (
    <Table containerClassName={containerClassName}>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          {showClient && <TableHead>Client</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead>Issued</TableHead>
          <TableHead>Due</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((inv) => (
          <TableRow key={inv.id} className="relative">
            <TableCell>
              <Link href={hrefFor(inv)} className={rowLink}>
                {inv.number}
              </Link>
              {inv.project && <div className="text-xs text-muted-foreground">{inv.project.name}</div>}
            </TableCell>
            {showClient && <TableCell className="text-muted-foreground">{inv.client.name}</TableCell>}
            <TableCell>
              <InvoiceStatusBadge status={inv.displayStatus} />
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">{formatDateOnly(inv.issueDate, { short: true })}</TableCell>
            <TableCell className={inv.displayStatus === "OVERDUE" ? "font-medium text-primary-strong tabular-nums" : "text-muted-foreground tabular-nums"}>
              {formatDateOnly(inv.dueDate, { short: true })}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatAmount(inv.total, inv.currency)}</TableCell>
            <TableCell className="text-right tabular-nums">{inv.balance > 0 ? formatAmount(inv.balance, inv.currency) : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ProposalTable({
  proposals,
  hrefFor,
  showRecipient = true,
  containerClassName,
}: {
  proposals: ProposalSummaryDTO[]
  hrefFor: (proposal: ProposalSummaryDTO) => string
  showRecipient?: boolean
  containerClassName?: string
}) {
  return (
    <Table containerClassName={containerClassName}>
      <TableHeader>
        <TableRow>
          <TableHead>Proposal</TableHead>
          {showRecipient && <TableHead>For</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead>Issued</TableHead>
          <TableHead>Valid until</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {proposals.map((p) => (
          <TableRow key={p.id} className="relative">
            <TableCell>
              <Link href={hrefFor(p)} className={rowLink}>
                {p.title}
              </Link>
              <div className="text-xs text-muted-foreground">{p.number}</div>
            </TableCell>
            {showRecipient && (
              <TableCell className="text-muted-foreground">
                {p.recipient ? (
                  <>
                    {p.recipient.name}
                    {p.recipient.kind === "lead" && <span className="ml-1.5 text-xs">(lead)</span>}
                  </>
                ) : (
                  "—"
                )}
              </TableCell>
            )}
            <TableCell>
              <ProposalStatusBadge status={p.displayStatus} />
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">{formatDateOnly(p.issueDate, { short: true })}</TableCell>
            <TableCell className="text-muted-foreground tabular-nums">{p.validUntil ? formatDateOnly(p.validUntil, { short: true }) : "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{formatAmount(p.total, p.currency)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export { InvoiceTable, ProposalTable }
