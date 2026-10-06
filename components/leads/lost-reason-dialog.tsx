"use client"

import * as React from "react"

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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { lostReasons, type LostReasonKey } from "@/lib/leads/constants"
import { cn } from "@/lib/utils"

type LostReasonDialogProps = {
  open: boolean
  leadName: string
  pending?: boolean
  onCancel: () => void
  onConfirm: (reason: LostReasonKey, detail: string) => void
}

/** Lost deals always need a reason, so the pipeline can show why deals are lost. */
function LostReasonDialog({ open, leadName, pending, onCancel, onConfirm }: LostReasonDialogProps) {
  const [reason, setReason] = React.useState<LostReasonKey | null>(null)
  const [detail, setDetail] = React.useState("")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onCancel()
          setReason(null)
          setDetail("")
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why was {leadName} lost?</DialogTitle>
          <DialogDescription>The reason is tracked so you can see patterns across the pipeline.</DialogDescription>
        </DialogHeader>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Reason</legend>
          <div className="grid grid-cols-2 gap-2">
            {lostReasons.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors duration-150 ease-out hover:bg-surface has-focus-visible:ring-2 has-focus-visible:ring-ring",
                  reason === option.value && "border-primary bg-primary-tint text-primary-strong"
                )}
              >
                <input
                  type="radio"
                  name="lost-reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lost-detail">Details (optional)</Label>
          <Textarea
            id="lost-detail"
            value={detail}
            maxLength={500}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="What would have changed the outcome?"
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            disabled={!reason || pending}
            onClick={() => {
              if (!reason) return
              onConfirm(reason, detail)
              setReason(null)
              setDetail("")
            }}
          >
            Mark as lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { LostReasonDialog }
