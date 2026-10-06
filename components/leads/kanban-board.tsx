"use client"

import * as React from "react"
import Link from "next/link"
import { BellIcon, MoreHorizontalIcon } from "lucide-react"

import { LostReasonDialog } from "@/components/leads/lost-reason-dialog"
import { StageBadge } from "@/components/leads/stage-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/toast"
import { markLeadLost, moveLead } from "@/lib/actions/leads"
import { formatShortDate, initials, isSameDay } from "@/lib/format"
import { sourceLabels } from "@/lib/leads/constants"
import type { BoardColumnDTO, LeadCardDTO, StageDTO } from "@/lib/leads/types"
import { formatMoney, formatTotals } from "@/lib/money"
import { cn } from "@/lib/utils"

type Move = { leadId: string; stageId: string; beforeLeadId: string | null }

/** Applies a move locally so the board updates before the server responds. */
function applyMove(columns: BoardColumnDTO[], move: Move): BoardColumnDTO[] {
  let moving: LeadCardDTO | undefined
  const without = columns.map((col) => {
    const lead = col.leads.find((l) => l.id === move.leadId)
    if (lead) moving = lead
    return { ...col, leads: col.leads.filter((l) => l.id !== move.leadId) }
  })
  if (!moving) return columns
  const moved = { ...moving, stageId: move.stageId }
  return without.map((col) => {
    if (col.id !== move.stageId) return col
    const index = move.beforeLeadId ? col.leads.findIndex((l) => l.id === move.beforeLeadId) : -1
    const leads = [...col.leads]
    leads.splice(index === -1 ? leads.length : index, 0, moved)
    return { ...col, leads }
  })
}

function columnTotals(leads: LeadCardDTO[]) {
  const totals: Record<string, number> = {}
  for (const lead of leads) totals[lead.currency] = (totals[lead.currency] ?? 0) + lead.value
  return totals
}

function FollowUpChip({ iso }: { iso: string }) {
  const due = new Date(iso)
  const now = new Date()
  const overdue = due < now
  const today = isSameDay(due, now)
  const label = today ? "Today" : formatShortDate(due)
  return (
    <span
      suppressHydrationWarning
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium",
        overdue ? "bg-destructive-tint text-primary-strong" : today ? "bg-warning-tint text-warning" : "bg-muted text-muted-foreground"
      )}
    >
      <BellIcon aria-hidden className="size-3" />
      <span className="sr-only">Follow-up {overdue ? "overdue" : "due"}:</span>
      {label}
    </span>
  )
}

function LeadCard({
  lead,
  stages,
  canWrite,
  dragging,
  onDragStart,
  onDragEnd,
  onMoveTo,
}: {
  lead: LeadCardDTO
  stages: StageDTO[]
  canWrite: boolean
  dragging: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onMoveTo: (stageId: string) => void
}) {
  return (
    <article
      draggable={canWrite}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-lead-id={lead.id}
      className={cn(
        "group/card relative rounded-lg border border-border bg-card p-3 shadow-xs transition-[border-color,opacity] duration-150 ease-out hover:border-input",
        canWrite && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-40"
      )}
    >
      <Link
        href={`/leads/${lead.id}`}
        draggable={false}
        className="block rounded-sm pr-6 font-medium outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring"
      >
        {lead.company ?? lead.name}
      </Link>
      {lead.company && <p className="truncate text-xs text-muted-foreground">{lead.name}</p>}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="font-heading text-sm font-semibold tabular-nums">{formatMoney(lead.value, lead.currency)}</span>
        {lead.owner ? (
          <Avatar size="sm" className="size-6" title={lead.owner.name}>
            <AvatarFallback className="text-[10px] font-medium">{initials(lead.owner.name)}</AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-[11px] text-muted-foreground">Unassigned</span>
        )}
      </div>

      {(lead.nextFollowUp || lead.services.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {lead.nextFollowUp && <FollowUpChip iso={lead.nextFollowUp} />}
          {lead.services.slice(0, 2).map((service) => (
            <span key={service} className="max-w-36 truncate rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {service}
            </span>
          ))}
          {lead.services.length > 2 && (
            <span className="text-[11px] text-muted-foreground">+{lead.services.length - 2}</span>
          )}
        </div>
      )}
      <span className="sr-only">Source: {sourceLabels[lead.source]}</span>

      {canWrite && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Move ${lead.company ?? lead.name}`}
                className="absolute top-2 right-2 z-10 text-muted-foreground opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {stages
                .filter((s) => s.id !== lead.stageId)
                .map((stage) => (
                  <DropdownMenuItem key={stage.id} onClick={() => onMoveTo(stage.id)}>
                    {stage.name}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </article>
  )
}

function KanbanBoard({ columns, canWrite }: { columns: BoardColumnDTO[]; canWrite: boolean }) {
  const toast = useToast()
  const [optimistic, addOptimisticMove] = React.useOptimistic(columns, applyMove)
  const [, startTransition] = React.useTransition()
  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [dropTarget, setDropTarget] = React.useState<{ stageId: string; beforeLeadId: string | null } | null>(null)
  const [pendingLost, setPendingLost] = React.useState<{ lead: LeadCardDTO; stageId: string } | null>(null)

  const stages: StageDTO[] = optimistic.map(({ id, name, kind, tone, position }) => ({ id, name, kind, tone, position }))
  const findLead = (id: string) => optimistic.flatMap((c) => c.leads).find((l) => l.id === id)

  function commitMove(move: Move) {
    const lead = findLead(move.leadId)
    const stage = stages.find((s) => s.id === move.stageId)
    if (!lead || !stage) return
    if (stage.kind === "LOST" && lead.stageId !== stage.id) {
      setPendingLost({ lead, stageId: stage.id })
      return
    }
    if (lead.stageId === move.stageId && move.beforeLeadId === lead.id) return
    startTransition(async () => {
      addOptimisticMove(move)
      const result = await moveLead(move.leadId, move.stageId, move.beforeLeadId)
      if (!result.ok) toast.add({ type: "error", title: "Couldn't move lead", description: result.error })
    })
  }

  function confirmLost(reason: string, detail: string) {
    if (!pendingLost) return
    const { lead, stageId } = pendingLost
    setPendingLost(null)
    startTransition(async () => {
      addOptimisticMove({ leadId: lead.id, stageId, beforeLeadId: null })
      const result = await markLeadLost({ leadId: lead.id, stageId, reason, detail })
      if (!result.ok) toast.add({ type: "error", title: "Couldn't mark as lost", description: result.error })
    })
  }

  /** Works out which card the pointer is above, so drops can reorder within a column. */
  function handleDragOver(e: React.DragEvent, stageId: string) {
    if (!draggingId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const cards = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-lead-id]"))
    const before = cards.find((card) => {
      const rect = card.getBoundingClientRect()
      return e.clientY < rect.top + rect.height / 2
    })
    const beforeLeadId = before?.dataset.leadId ?? null
    if (dropTarget?.stageId !== stageId || dropTarget.beforeLeadId !== beforeLeadId) {
      setDropTarget({ stageId, beforeLeadId })
    }
  }

  return (
    <>
      <div className="-mx-6 overflow-x-auto px-6 pb-4 lg:-mx-8 lg:px-8">
        <div className="grid auto-cols-[minmax(260px,1fr)] grid-flow-col gap-3">
          {optimistic.map((column) => {
            const isTarget = dropTarget?.stageId === column.id
            return (
              <section
                key={column.id}
                aria-label={`${column.name}, ${column.leads.length} leads`}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const leadId = e.dataTransfer.getData("text/plain") || draggingId
                  if (leadId) commitMove({ leadId, stageId: column.id, beforeLeadId: dropTarget?.beforeLeadId ?? null })
                  setDropTarget(null)
                  setDraggingId(null)
                }}
                className={cn(
                  "flex min-h-40 flex-col gap-2 rounded-xl border border-border bg-surface p-2 transition-colors duration-150 ease-out",
                  isTarget && "border-primary/40 bg-primary-tint"
                )}
              >
                <header className="flex items-center justify-between gap-2 px-1.5 pt-1 pb-1">
                  <div className="flex items-center gap-2">
                    <StageBadge name={column.name} tone={column.tone} muted={column.kind === "LOST"} />
                    <span className="text-xs text-muted-foreground tabular-nums">{column.leads.length}</span>
                  </div>
                  {column.leads.length > 0 && (
                    <span className="truncate text-xs text-muted-foreground tabular-nums">
                      {formatTotals(columnTotals(column.leads), { compact: true })}
                    </span>
                  )}
                </header>

                {column.leads.map((lead) => (
                  <React.Fragment key={lead.id}>
                    {isTarget && dropTarget?.beforeLeadId === lead.id && draggingId !== lead.id && (
                      <div aria-hidden className="h-0.5 rounded-full bg-primary" />
                    )}
                    <LeadCard
                      lead={lead}
                      stages={stages}
                      canWrite={canWrite}
                      dragging={draggingId === lead.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", lead.id)
                        e.dataTransfer.effectAllowed = "move"
                        setDraggingId(lead.id)
                      }}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setDropTarget(null)
                      }}
                      onMoveTo={(stageId) => commitMove({ leadId: lead.id, stageId, beforeLeadId: null })}
                    />
                  </React.Fragment>
                ))}
                {isTarget && dropTarget?.beforeLeadId === null && (
                  <div aria-hidden className="h-0.5 rounded-full bg-primary" />
                )}
                {column.leads.length === 0 && !isTarget && (
                  <p className="px-1.5 py-6 text-center text-xs text-muted-foreground">No leads</p>
                )}
              </section>
            )
          })}
        </div>
      </div>

      <LostReasonDialog
        open={pendingLost !== null}
        leadName={pendingLost?.lead.company ?? pendingLost?.lead.name ?? ""}
        onCancel={() => setPendingLost(null)}
        onConfirm={confirmLost}
      />
    </>
  )
}

export { KanbanBoard }
