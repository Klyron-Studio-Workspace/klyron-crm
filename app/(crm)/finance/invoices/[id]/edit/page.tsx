import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { InvoiceForm } from "@/components/finance/document-forms"
import { requirePermission } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { getCatalog, getInvoice } from "@/lib/finance/queries"

export const metadata: Metadata = { title: "Edit invoice" }

export default async function EditInvoicePage({ params }: PageProps<"/finance/invoices/[id]/edit">) {
  await requirePermission("finance", "WRITE")
  const { id } = await params
  const invoice = await getInvoice(id)
  if (!invoice) notFound()
  if (invoice.status === "PAID" || invoice.status === "VOID") redirect(`/finance/invoices/${id}`)

  const [clients, projects, catalog] = await Promise.all([
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, clientId: true } }),
    getCatalog(),
  ])

  return (
    <section aria-labelledby="edit-invoice" className="flex flex-col gap-4">
      <div>
        <h2 id="edit-invoice" className="text-lg font-semibold">Edit {invoice.number}</h2>
        {invoice.status === "SENT" && (
          <p className="text-sm text-muted-foreground">Already sent: the client&rsquo;s link shows your changes straight away.</p>
        )}
      </div>
      <InvoiceForm
        invoiceId={invoice.id}
        clients={clients}
        projects={projects}
        catalog={catalog}
        cancelHref={`/finance/invoices/${invoice.id}`}
        currencyLocked={invoice.amountPaid > 0}
        initial={{
          clientId: invoice.client.id,
          projectId: invoice.project?.id ?? "",
          proposalId: "",
          currency: invoice.currency,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          notes: invoice.notes ?? "",
          discount: invoice.totals.discount,
          taxRate: invoice.totals.taxRate,
          items: invoice.items,
        }}
      />
    </section>
  )
}
