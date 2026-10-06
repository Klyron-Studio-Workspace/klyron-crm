import type { Metadata } from "next"
import { KanbanSquareIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { KanbanBoard } from "@/components/leads/kanban-board"
import { LeadFilters } from "@/components/leads/lead-filters"
import { LeadTable } from "@/components/leads/lead-table"
import { NewLeadDialog } from "@/components/leads/new-lead-dialog"
import { PageHeader } from "@/components/layout/page-header"
import { can, requirePermission } from "@/lib/auth/dal"
import { leadSources, type LeadSourceKey } from "@/lib/leads/constants"
import {
  getAssignableMembers,
  getBoard,
  getLeadList,
  getOrgSettings,
  getServices,
  getStages,
  leadScope,
  type LeadFilters as Filters,
} from "@/lib/leads/queries"

export const metadata: Metadata = { title: "Leads" }

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const user = await requirePermission("leads", "READ")
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

  const view = one(sp.view) === "list" ? "list" : "board"
  const source = one(sp.source)
  const filters: Filters = {
    q: one(sp.q)?.slice(0, 100),
    ownerId: one(sp.owner),
    source: leadSources.includes(source as LeadSourceKey) ? (source as LeadSourceKey) : undefined,
  }

  const [canWrite, stages, members, services, org, scope] = await Promise.all([
    can(user, "leads", "WRITE"),
    getStages(),
    getAssignableMembers(),
    getServices(),
    getOrgSettings(),
    leadScope(user),
  ])
  const ownerLocked = Boolean(scope.ownerId)

  const board = view === "board" ? await getBoard(user, filters) : null
  const list = view === "list" ? await getLeadList(user, filters) : null
  const total = board ? board.reduce((n, c) => n + c.leads.length, 0) : (list?.length ?? 0)
  const filtered = Boolean(filters.q || filters.ownerId || filters.source)

  return (
    <>
      <PageHeader
        title="Leads"
        description={ownerLocked ? "Leads assigned to you." : "Every opportunity, from first contact to signed."}
        actions={
          canWrite && (
            <NewLeadDialog
              stages={stages}
              members={members}
              services={services}
              currentUserId={user.id}
              defaultCurrency={org.defaultCurrency}
              ownerLocked={ownerLocked}
            />
          )
        }
      />
      <div className="flex flex-col gap-4">
        <LeadFilters members={members} view={view} showOwnerFilter={!ownerLocked} />
        {total === 0 && !filtered ? (
          <EmptyState
            icon={KanbanSquareIcon}
            title="An empty pipeline."
            description="Add your first lead to start tracking conversations, follow-ups and deal value."
          />
        ) : board ? (
          <KanbanBoard columns={board} canWrite={canWrite} />
        ) : list && list.length > 0 ? (
          <LeadTable leads={list} stages={stages} />
        ) : (
          <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No leads match these filters.
          </p>
        )}
      </div>
    </>
  )
}
