import type { Metadata } from "next"
import { UsersIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { ProposalForm } from "@/components/finance/document-forms"
import { requirePermission } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { getCatalog, getOrgBilling, todayKey } from "@/lib/finance/queries"
import { getProposalRecipients } from "@/lib/finance/recipients"

export const metadata: Metadata = { title: "New proposal" }

function addDays(ymd: string, days: number) {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

export default async function NewProposalPage({ searchParams }: PageProps<"/finance/proposals/new">) {
  await requirePermission("finance", "WRITE")
  const sp = await searchParams
  const requested = typeof sp.leadId === "string" ? `lead:${sp.leadId}` : typeof sp.clientId === "string" ? `client:${sp.clientId}` : undefined
  const [recipients, catalog, org] = await Promise.all([getProposalRecipients(requested), getCatalog(), getOrgBilling()])
  if (recipients.length === 0) {
    return <EmptyState icon={UsersIcon} title="Add a lead or client first." description="Proposals are addressed to a lead or a client." />
  }

  const recipient = requested && recipients.some((r) => r.value === requested) ? requested : recipients[0].value
  // A lead's interested services make a good starting point.
  let items: { serviceId: string; description: string; quantity: number; unitPrice: number; amount: number }[] = []
  let currency = org.defaultCurrency
  if (recipient.startsWith("lead:")) {
    const lead = await db.lead.findUnique({ where: { id: recipient.slice(5) }, select: { currency: true, services: { select: { serviceId: true } } } })
    if (lead) {
      currency = lead.currency
      const wanted = new Set(lead.services.map((s) => s.serviceId))
      items = catalog
        .filter((s) => wanted.has(s.id))
        .map((s) => ({ serviceId: s.id, description: s.description ? `${s.name}: ${s.description}` : s.name, quantity: 1, unitPrice: s.price ?? 0, amount: s.price ?? 0 }))
    }
  }

  const today = todayKey()
  return (
    <section aria-labelledby="new-proposal" className="flex flex-col gap-4">
      <h2 id="new-proposal" className="text-lg font-semibold">New proposal</h2>
      <ProposalForm
        recipients={recipients}
        catalog={catalog}
        cancelHref="/finance/proposals"
        initial={{
          recipient,
          title: "",
          currency,
          issueDate: today,
          validUntil: addDays(today, 30),
          introduction: "",
          terms: "",
          discount: 0,
          taxRate: org.defaultTaxRate,
          items,
        }}
      />
    </section>
  )
}
