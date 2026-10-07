import Link from "next/link"
import { PlusIcon } from "lucide-react"

import { formatAmount } from "@/components/finance/document-view"
import { InvoiceStatusBadge, ProposalStatusBadge } from "@/components/finance/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { listInvoices, listProposals } from "@/lib/finance/queries"
import { addTo } from "@/lib/finance/math"
import { formatTotals } from "@/lib/money"

/** Proposals (and, for clients, invoices) on a client or lead page. */
async function BillingCard({ clientId, leadId, canWrite }: { clientId?: string; leadId?: string; canWrite: boolean }) {
  const [invoices, proposals] = await Promise.all([
    clientId ? listInvoices({ clientId }) : Promise.resolve([]),
    listProposals(clientId ? { clientId } : { leadId }),
  ])
  const outstanding: Record<string, number> = {}
  for (const inv of invoices) if (inv.status === "SENT") addTo(outstanding, inv.currency, inv.balance)
  const query = clientId ? `clientId=${clientId}` : `leadId=${leadId}`

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base font-semibold">Billing</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {clientId && (
          <p className="text-muted-foreground">
            Outstanding: <span className="font-medium text-foreground">{formatTotals(outstanding)}</span>
          </p>
        )}
        {proposals.length === 0 && invoices.length === 0 && <p className="text-muted-foreground">No proposals{clientId ? " or invoices" : ""} yet.</p>}
        {(proposals.length > 0 || invoices.length > 0) && (
          <ul className="flex flex-col divide-y divide-border">
            {proposals.slice(0, 4).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                <div className="min-w-0">
                  <Link href={`/finance/proposals/${p.id}`} className="link block truncate">{p.title}</Link>
                  <p className="text-xs text-muted-foreground">{p.number} · {formatAmount(p.total, p.currency)}</p>
                </div>
                <ProposalStatusBadge status={p.displayStatus} />
              </li>
            ))}
            {invoices.slice(0, 5).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                <div className="min-w-0">
                  <Link href={`/finance/invoices/${i.id}`} className="link">{i.number}</Link>
                  <p className="text-xs text-muted-foreground">{formatAmount(i.total, i.currency)}</p>
                </div>
                <InvoiceStatusBadge status={i.displayStatus} />
              </li>
            ))}
          </ul>
        )}
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" nativeButton={false} render={<Link href={`/finance/proposals/new?${query}`} />}>
              <PlusIcon data-icon="inline-start" />
              Proposal
            </Button>
            {clientId && (
              <Button size="sm" variant="secondary" nativeButton={false} render={<Link href={`/finance/invoices/new?${query}`} />}>
                <PlusIcon data-icon="inline-start" />
                Invoice
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { BillingCard }
