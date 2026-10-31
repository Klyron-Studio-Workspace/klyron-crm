import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DocumentView } from "@/components/finance/document-view"
import { AutoPrint, PrintButton } from "@/components/finance/public-bits"
import { InvoiceStatusBadge } from "@/components/finance/status-badge"
import { FormAlert } from "@/components/forms/form-alert"
import { getCurrentUser } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import { getInvoiceByToken, getOrgBilling } from "@/lib/finance/queries"
import { recordFirstView } from "@/lib/finance/views"

export const metadata: Metadata = { title: "Invoice" }

/** The client's view of an invoice. The unguessable token in the URL is the only credential. */
export default async function PublicInvoicePage({ params, searchParams }: PageProps<"/i/[token]">) {
  const { token } = await params
  const { pdf } = await searchParams
  const [invoice, org, viewer] = await Promise.all([getInvoiceByToken(token), getOrgBilling(), getCurrentUser()])
  const isTeam = Boolean(viewer && isTeamRole(viewer.role))
  if (!invoice || (invoice.status === "DRAFT" && !isTeam)) notFound()
  await recordFirstView("invoice", invoice.id, Boolean(invoice.viewedAt))

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8 sm:px-6 print:max-w-none print:p-0">
      {pdf === "1" && <AutoPrint />}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <InvoiceStatusBadge status={invoice.displayStatus} />
        <PrintButton />
      </div>
      {isTeam && invoice.status === "DRAFT" && <FormAlert tone="error" className="print:hidden">Draft preview. The client can&rsquo;t open this link until it&rsquo;s sent.</FormAlert>}
      {invoice.status === "VOID" && <FormAlert tone="error">This invoice has been cancelled and nothing is owed on it.</FormAlert>}
      {invoice.status === "PAID" && <FormAlert tone="success">Paid in full. Thank you!</FormAlert>}
      <DocumentView
        kind="invoice"
        number={invoice.number}
        studio={org.studio}
        billTo={invoice.billTo}
        currency={invoice.currency}
        dates={[
          { label: "Issued", value: invoice.issueDate },
          { label: "Due", value: invoice.dueDate },
        ]}
        items={invoice.items}
        totals={invoice.totals}
        amountPaid={invoice.amountPaid}
        notes={invoice.notes}
        showPaymentInstructions={invoice.status !== "VOID"}
      />
    </main>
  )
}
