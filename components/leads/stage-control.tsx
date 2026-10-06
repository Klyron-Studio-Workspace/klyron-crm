"use client"

import * as React from "react"

import { LostReasonDialog } from "@/components/leads/lost-reason-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import { markLeadLost, moveLead } from "@/lib/actions/leads"
import type { StageDTO } from "@/lib/leads/types"

/** Stage picker on the lead page. Choosing a Lost stage asks for a reason first. */
function StageControl({
  leadId,
  leadName,
  stageId,
  stages,
}: {
  leadId: string
  leadName: string
  stageId: string
  stages: StageDTO[]
}) {
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()
  const [optimistic, setOptimistic] = React.useOptimistic(stageId)
  const [lostStage, setLostStage] = React.useState<string | null>(null)
  const items = stages.map((s) => ({ value: s.id, label: s.name }))

  return (
    <>
      <Select
        items={items}
        value={optimistic}
        disabled={pending}
        onValueChange={(next: string | null) => {
          if (!next || next === optimistic) return
          const stage = stages.find((s) => s.id === next)
          if (stage?.kind === "LOST") {
            setLostStage(next)
            return
          }
          startTransition(async () => {
            setOptimistic(next)
            const result = await moveLead(leadId, next)
            if (!result.ok) toast.add({ type: "error", title: "Couldn't change stage", description: result.error })
          })
        }}
      >
        <SelectTrigger aria-label="Stage" className="h-9 min-w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <LostReasonDialog
        open={lostStage !== null}
        leadName={leadName}
        pending={pending}
        onCancel={() => setLostStage(null)}
        onConfirm={(reason, detail) => {
          const target = lostStage
          setLostStage(null)
          if (!target) return
          startTransition(async () => {
            setOptimistic(target)
            const result = await markLeadLost({ leadId, stageId: target, reason, detail })
            if (!result.ok) toast.add({ type: "error", title: "Couldn't mark as lost", description: result.error })
          })
        }}
      />
    </>
  )
}

export { StageControl }
