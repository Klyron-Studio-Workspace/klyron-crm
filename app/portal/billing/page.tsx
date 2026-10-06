import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ReceiptTextIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { InvoiceTable, ProposalTable } from "@/components/finance/document-tables"
import { can, requireClientUser } from "@/lib/auth/dal"
import { getClientBilling } from "@/lib/finance/queries"
import { formatTotals } from "@/lib/money"

export const metadata: Metadata = { title: "Billing" }

/** Sent invoices and proposals for the client. Documents open on their secret-link pages. */
export default async function PortalBillingPage() {
  const user = await requireClientUser()
  if (!(await can(user, "finance", "READ"))) notFound()
  const billing = await getClientBilling(user.clientId, { includeDrafts: false })
  const owed = Object.values(billing.outstanding).some((v) => v > 0)

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          {owed ? (
            <>
              Outstanding balance: <span className="font-medium text-foreground">{formatTotals(billing.outstanding)}</span>
            </>
          ) : (
            "You're all paid up. Thank you!"
          )}
        </p>
      </div>

      {billing.invoices.length === 0 && billing.proposals.length === 0 ? (
        <EmptyState icon={ReceiptTextIcon} title="Nothing here yet." description="Invoices and proposals from Klyron Studio will appear here." />
      ) : (
        <>
          {billing.proposals.length > 0 && (
            <section aria-labelledby="portal-proposals" className="flex flex-col gap-3">
              <h2 id="portal-proposals" className="text-base font-semibold">Proposals</h2>
              <ProposalTable proposals={billing.proposals} hrefFor={(p) => `/p/${p.publicToken}`} showRecipient={false} />
            </section>
          )}
          {billing.invoices.length > 0 && (
            <section aria-labelledby="portal-invoices" className="flex flex-col gap-3">
              <h2 id="portal-invoices" className="text-base font-semibold">Invoices</h2>
              <InvoiceTable invoices={billing.invoices} hrefFor={(i) => `/i/${i.publicToken}`} showClient={false} />
            </section>
          )}
        </>
      )}
    </>
  )
}
