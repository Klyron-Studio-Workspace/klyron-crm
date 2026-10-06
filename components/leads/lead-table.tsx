import Link from "next/link"

import { StageBadge } from "@/components/leads/stage-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatRelative } from "@/lib/format"
import { sourceLabels } from "@/lib/leads/constants"
import type { LeadCardDTO, StageDTO } from "@/lib/leads/types"
import { formatMoney } from "@/lib/money"

function LeadTable({ leads, stages }: { leads: LeadCardDTO[]; stages: StageDTO[] }) {
  const stageById = new Map(stages.map((s) => [s.id, s]))
  return (
    <Table containerClassName="max-h-[calc(100svh-16rem)]">
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Next follow-up</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => {
          const stage = stageById.get(lead.stageId)
          const due = lead.nextFollowUp ? new Date(lead.nextFollowUp) : null
          return (
            <TableRow key={lead.id} className="relative">
              <TableCell>
                <Link
                  href={`/leads/${lead.id}`}
                  className="font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                >
                  {lead.company ?? lead.name}
                </Link>
                {lead.company && <div className="text-xs text-muted-foreground">{lead.name}</div>}
              </TableCell>
              <TableCell>{stage && <StageBadge name={stage.name} tone={stage.tone} muted={stage.kind === "LOST"} />}</TableCell>
              <TableCell className="text-right font-medium">{formatMoney(lead.value, lead.currency)}</TableCell>
              <TableCell className={lead.owner ? undefined : "text-muted-foreground"}>{lead.owner?.name ?? "Unassigned"}</TableCell>
              <TableCell className="text-muted-foreground">{sourceLabels[lead.source]}</TableCell>
              <TableCell suppressHydrationWarning className={due && due < new Date() ? "font-medium text-primary-strong" : "text-muted-foreground"}>
                {due ? formatRelative(due) : "—"}
              </TableCell>
              <TableCell suppressHydrationWarning className="text-muted-foreground">{formatRelative(new Date(lead.updatedAt))}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export { LeadTable }
