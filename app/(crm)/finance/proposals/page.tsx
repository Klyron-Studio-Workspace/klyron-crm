import type { Metadata } from "next"
import Link from "next/link"
import { FileSignatureIcon, PlusIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { ProposalTable } from "@/components/finance/document-tables"
import { FilterChips } from "@/components/finance/filter-chips"
import { Button } from "@/components/ui/button"
import { can, requirePermission } from "@/lib/auth/dal"
import { listProposals, type ProposalFilter } from "@/lib/finance/queries"

export const metadata: Metadata = { title: "Proposals" }

const filters: { value: ProposalFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "SENT", label: "Awaiting answer" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DECLINED", label: "Declined" },
  { value: "EXPIRED", label: "Expired" },
  { value: "DRAFT", label: "Drafts" },
]

export default async function ProposalsPage({ searchParams }: PageProps<"/finance/proposals">) {
  const user = await requirePermission("finance", "READ")
  const sp = await searchParams
  const status = filters.find((f) => f.value === sp.status)?.value ?? "all"
  const [proposals, canWrite] = await Promise.all([listProposals({ filter: status }), can(user, "finance", "WRITE")])

  return (
    <section aria-label="Proposals" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label="Filter proposals"
          chips={filters.map((f) => ({ label: f.label, href: f.value === "all" ? "/finance/proposals" : `/finance/proposals?status=${f.value}`, active: f.value === status }))}
        />
        {canWrite && (
          <Button nativeButton={false} render={<Link href="/finance/proposals/new" />}>
            <PlusIcon data-icon="inline-start" />
            New proposal
          </Button>
        )}
      </div>
      {proposals.length === 0 ? (
        <EmptyState
          icon={FileSignatureIcon}
          title={status === "all" ? "No proposals yet." : "Nothing here."}
          description={status === "all" ? "Price up work for a lead or client. They can accept it online." : "No proposals match this filter."}
        />
      ) : (
        <ProposalTable proposals={proposals} hrefFor={(p) => `/finance/proposals/${p.id}`} />
      )}
    </section>
  )
}
