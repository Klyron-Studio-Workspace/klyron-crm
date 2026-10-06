import type { Metadata } from "next"
import Link from "next/link"
import { PlusIcon, ReceiptTextIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { InvoiceTable } from "@/components/finance/document-tables"
import { FilterChips } from "@/components/finance/filter-chips"
import { Button } from "@/components/ui/button"
import { can, requirePermission } from "@/lib/auth/dal"
import { listInvoices, type InvoiceFilter } from "@/lib/finance/queries"

export const metadata: Metadata = { title: "Invoices" }

const filters: { value: InvoiceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Unpaid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "DRAFT", label: "Drafts" },
  { value: "PAID", label: "Paid" },
  { value: "VOID", label: "Void" },
]

export default async function InvoicesPage({ searchParams }: PageProps<"/finance/invoices">) {
  const user = await requirePermission("finance", "READ")
  const sp = await searchParams
  const status = filters.find((f) => f.value === sp.status)?.value ?? "all"
  const [invoices, canWrite] = await Promise.all([listInvoices({ filter: status }), can(user, "finance", "WRITE")])

  return (
    <section aria-label="Invoices" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label="Filter invoices"
          chips={filters.map((f) => ({ label: f.label, href: f.value === "all" ? "/finance/invoices" : `/finance/invoices?status=${f.value}`, active: f.value === status }))}
        />
        {canWrite && (
          <Button nativeButton={false} render={<Link href="/finance/invoices/new" />}>
            <PlusIcon data-icon="inline-start" />
            New invoice
          </Button>
        )}
      </div>
      {invoices.length === 0 ? (
        <EmptyState
          icon={ReceiptTextIcon}
          title={status === "all" ? "No invoices yet." : "Nothing here."}
          description={status === "all" ? "Create one with “New invoice”, or turn an accepted proposal into an invoice." : "No invoices match this filter."}
        />
      ) : (
        <InvoiceTable invoices={invoices} hrefFor={(i) => `/finance/invoices/${i.id}`} />
      )}
    </section>
  )
}
