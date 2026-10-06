"use client"

import * as React from "react"
import { useActionState } from "react"
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { FormAlert } from "@/components/forms/form-alert"
import { StageBadge } from "@/components/leads/stage-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import { createStage, deleteStage, moveStage, updateStage } from "@/lib/actions/pipeline"
import { stageToneLabels, stageTones, type StageToneKey } from "@/lib/leads/constants"
import type { StageDTO } from "@/lib/leads/types"

export type StageRow = StageDTO & { leadCount: number }

const toneItems = stageTones.map((t) => ({ value: t, label: stageToneLabels[t] }))
const kindLabel = { OPEN: "Open", WON: "Won", LOST: "Lost" } as const

function ToneSelect({ value, onChange, name, label }: { value: StageToneKey; onChange?: (v: StageToneKey) => void; name?: string; label: string }) {
  return (
    <Select name={name} items={toneItems} value={value} onValueChange={(v: StageToneKey | null) => v && onChange?.(v)}>
      <SelectTrigger size="sm" aria-label={label} className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {toneItems.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function StageRowEditor({ stage, index, stages }: { stage: StageRow; index: number; stages: StageRow[] }) {
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()
  const [name, setName] = React.useState(stage.name)
  const [tone, setTone] = React.useState<StageToneKey>(stage.tone)
  const [deleting, setDeleting] = React.useState(false)
  const sameKind = stages.filter((s) => s.kind === stage.kind && s.id !== stage.id)
  const [moveTo, setMoveTo] = React.useState(sameKind[0]?.id ?? "")

  function save(next: { name?: string; tone?: StageToneKey }) {
    const payload = { name: next.name ?? name, tone: next.tone ?? tone }
    if (payload.name === stage.name && payload.tone === stage.tone) return
    startTransition(async () => {
      const result = await updateStage(stage.id, payload)
      if (!result.ok) {
        toast.add({ type: "error", title: "Couldn't save stage", description: result.error })
        setName(stage.name)
        setTone(stage.tone)
      }
    })
  }

  function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await task()
      if (!result.ok) toast.add({ type: "error", title: "Couldn't update pipeline", description: result.error })
    })
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="flex w-36 shrink-0">
        <StageBadge name={name || "Untitled"} tone={tone} muted={stage.kind === "LOST"} />
      </div>
      <Input
        aria-label={`Name of ${stage.name}`}
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => save({ name: name.trim() })}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-8 w-48"
      />
      <ToneSelect
        label={`Color of ${stage.name}`}
        value={tone}
        onChange={(v) => {
          setTone(v)
          save({ tone: v })
        }}
      />
      <span className="text-xs text-muted-foreground">
        {kindLabel[stage.kind]} · {stage.leadCount} {stage.leadCount === 1 ? "lead" : "leads"}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label={`Move ${stage.name} up`} disabled={pending || index === 0} onClick={() => run(() => moveStage(stage.id, "up"))}>
          <ArrowUpIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Move ${stage.name} down`} disabled={pending || index === stages.length - 1} onClick={() => run(() => moveStage(stage.id, "down"))}>
          <ArrowDownIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${stage.name}`} disabled={pending} onClick={() => setDeleting(true)} className="text-muted-foreground hover:text-primary-strong">
          <Trash2Icon />
        </Button>
      </div>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{stage.name}”?</DialogTitle>
            <DialogDescription>
              {stage.leadCount > 0
                ? `Its ${stage.leadCount} ${stage.leadCount === 1 ? "lead moves" : "leads move"} to the stage you choose.`
                : "No leads are in this stage."}
            </DialogDescription>
          </DialogHeader>
          {stage.leadCount > 0 && sameKind.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`move-${stage.id}`}>Move leads to</Label>
              <Select items={sameKind.map((s) => ({ value: s.id, label: s.name }))} value={moveTo} onValueChange={(v: string | null) => v && setMoveTo(v)}>
                <SelectTrigger id={`move-${stage.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sameKind.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setDeleting(false)
                run(() => deleteStage(stage.id, stage.leadCount > 0 ? moveTo : null))
              }}
            >
              Delete stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}

function AddStageForm() {
  const [state, action, pending] = useActionState(createStage, undefined)
  return (
    <form action={action} className="flex flex-col gap-2" noValidate>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-stage">New open stage</Label>
          <Input
            key={state?.ok ? "fresh" : state?.values?.name}
            id="new-stage"
            name="name"
            placeholder="e.g. Discovery call"
            maxLength={60}
            defaultValue={state?.ok ? "" : state?.values?.name}
            aria-invalid={state?.fieldErrors?.name ? true : undefined}
            className="h-8 w-56"
          />
        </div>
        <ToneSelect name="tone" label="Color of new stage" value={(state?.values?.tone as StageToneKey) ?? "NEUTRAL"} />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          <PlusIcon data-icon="inline-start" />
          Add stage
        </Button>
      </div>
      {state?.fieldErrors?.name && <p className="text-xs text-primary-strong">{state.fieldErrors.name[0]}</p>}
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
    </form>
  )
}

function StageEditor({ stages }: { stages: StageRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-col divide-y divide-border">
        {stages.map((stage, index) => (
          <StageRowEditor key={`${stage.id}-${stage.name}-${stage.tone}`} stage={stage} index={index} stages={stages} />
        ))}
      </ol>
      <div className="border-t border-border pt-5">
        <AddStageForm />
      </div>
    </div>
  )
}

export { StageEditor }
