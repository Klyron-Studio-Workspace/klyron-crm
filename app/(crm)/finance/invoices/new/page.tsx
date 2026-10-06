import type { Metadata } from "next"
import { BuildingIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { InvoiceForm } from "@/components/finance/document-forms"
import { requirePermission } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { getCatalog, getOrgBilling, todayKey } from "@/lib/finance/queries"

export const metadata: Metadata = { title: "New invoice" }

function addDays(ymd: string, days: number) {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

export default async function NewInvoicePage({ searchParams }: PageProps<"/finance/invoices/new">) {
  await requirePermission("finance", "WRITE")
  const sp = await searchParams
  const [clients, projects, catalog, org] = await Promise.all([
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ where: { status: { not: "CANCELLED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, clientId: true } }),
    getCatalog(),
    getOrgBilling(),
  ])
  if (clients.length === 0) {
    return <EmptyState icon={BuildingIcon} title="Add a client first." description="Invoices are always addressed to a client." />
  }

  const project = typeof sp.projectId === "string" ? projects.find((p) => p.id === sp.projectId) : undefined
  const clientId = project?.clientId ?? (typeof sp.clientId === "string" && clients.some((c) => c.id === sp.clientId) ? sp.clientId : clients[0].id)
  const today = todayKey()

  return (
    <section aria-labelledby="new-invoice" className="flex flex-col gap-4">
      <h2 id="new-invoice" className="text-lg font-semibold">New invoice</h2>
      <InvoiceForm
        clients={clients}
        projects={projects}
        catalog={catalog}
        cancelHref="/finance/invoices"
        initial={{
          clientId,
          projectId: project?.id ?? "",
          proposalId: "",
          currency: org.defaultCurrency,
          issueDate: today,
          dueDate: addDays(today, org.paymentTermsDays),
          notes: "",
          discount: 0,
          taxRate: org.defaultTaxRate,
          items: [],
        }}
      />
    </section>
  )
}
