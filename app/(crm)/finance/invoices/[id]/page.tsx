import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { DocumentActivity } from "@/components/finance/document-activity"
import { DocumentView, formatAmount } from "@/components/finance/document-view"
import { DeletePaymentButton, InvoiceActions } from "@/components/finance/invoice-actions"
import { InvoiceStatusBadge } from "@/components/finance/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { can, requirePermission } from "@/lib/auth/dal"
import { paymentMethodLabels } from "@/lib/finance/constants"
import { getInvoice, getOrgBilling, todayKey } from "@/lib/finance/queries"
import { formatDateOnly, formatDateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Invoice" }

export default async function InvoicePage({ params }: PageProps<"/finance/invoices/[id]">) {
  const user = await requirePermission("finance", "READ")
  const { id } = await params
  const [invoice, org, canWrite] = await Promise.all([getInvoice(id), getOrgBilling(), can(user, "finance", "WRITE")])
  if (!invoice) notFound()

  const facts = [
    { label: "Created", value: `${formatDateTime(new Date(invoice.createdAt))}${invoice.createdBy ? ` by ${invoice.createdBy}` : ""}` },
    invoice.sentAt && { label: "Sent", value: formatDateTime(new Date(invoice.sentAt)) },
    invoice.viewedAt && { label: "First viewed", value: formatDateTime(new Date(invoice.viewedAt)) },
    invoice.paidAt && { label: "Paid in full", value: formatDateTime(new Date(invoice.paidAt)) },
    invoice.reminderCount > 0 && { label: "Reminders", value: `${invoice.reminderCount} sent, last ${formatDateTime(new Date(invoice.lastReminderAt!))}` },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link href="/finance/invoices" className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon aria-hidden className="size-4" />
          Invoices
        </Link>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-2xl font-semibold tracking-tight">{invoice.number}</h2>
              <InvoiceStatusBadge status={invoice.displayStatus} />
            </div>
            <p className="text-sm text-muted-foreground">
              <Link href={`/clients/${invoice.client.id}`} className="link">
                {invoice.client.name}
              </Link>
              {invoice.project && (
                <>
                  {" · "}
                  <Link href={`/projects/${invoice.project.id}`} className="link">
                    {invoice.project.name}
                  </Link>
                </>
              )}
              {invoice.proposal && (
                <>
                  {" · from "}
                  <Link href={`/finance/proposals/${invoice.proposal.id}`} className="link">
                    {invoice.proposal.number}
                  </Link>
                </>
              )}
            </p>
          </div>
          {canWrite && (
            <InvoiceActions
              invoiceId={invoice.id}
              number={invoice.number}
              status={invoice.status}
              overdue={invoice.displayStatus === "OVERDUE"}
              publicPath={`/i/${invoice.publicToken}`}
              balance={invoice.balance}
              currency={invoice.currency}
              today={todayKey()}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
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
        />

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Payments</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {invoice.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {invoice.payments.map((p) => {
                    const label = formatAmount(p.amount, invoice.currency)
                    return (
                      <li key={p.id} className="flex items-start justify-between gap-3 py-2.5 text-sm first:pt-0">
                        <div className="min-w-0">
                          <p className="font-medium tabular-nums">{label}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateOnly(p.paidOn)} · {paymentMethodLabels[p.method]}
                            {p.reference && ` · ${p.reference}`}
                          </p>
                          {p.recordedBy && <p className="text-xs text-muted-foreground">Recorded by {p.recordedBy}</p>}
                        </div>
                        {canWrite && invoice.status !== "VOID" && <DeletePaymentButton paymentId={p.id} label={label} />}
                      </li>
                    )
                  })}
                </ul>
              )}
              <dl className="grid grid-cols-[1fr_auto] gap-y-1 border-t border-border pt-3 text-sm">
                <dt className="text-muted-foreground">Paid</dt>
                <dd className="text-right tabular-nums">{formatAmount(invoice.amountPaid, invoice.currency)}</dd>
                <dt className="text-muted-foreground">Balance</dt>
                <dd className="text-right font-medium tabular-nums">{formatAmount(invoice.balance, invoice.currency)}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2 text-sm">
                {facts.map((f) => (
                  <div key={f.label} className="grid grid-cols-[6.5rem_1fr] gap-3">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <DocumentActivity entityType="invoice" entityId={invoice.id} />
        </div>
      </div>
    </>
  )
}
