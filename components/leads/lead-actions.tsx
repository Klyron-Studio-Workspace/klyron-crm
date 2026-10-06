"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BuildingIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { LeadForm, type LeadFormValues } from "@/components/leads/lead-form"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useToast } from "@/components/ui/toast"
import { convertLeadToClient, deleteLead } from "@/lib/actions/leads"
import type { PersonDTO, ServiceDTO, StageDTO } from "@/lib/leads/types"

type LeadActionsProps = {
  leadId: string
  leadName: string
  converted: boolean
  canConvert: boolean
  canDelete: boolean
  ownerLocked: boolean
  form: { initial: LeadFormValues; stages: StageDTO[]; members: PersonDTO[]; services: ServiceDTO[] }
}

function LeadActions({ leadId, leadName, converted, canConvert, canDelete, ownerLocked, form }: LeadActionsProps) {
  const toast = useToast()
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [editing, setEditing] = React.useState(false)
  const [confirm, setConfirm] = React.useState<"convert" | "delete" | null>(null)

  return (
    <div className="flex items-center gap-2">
      {!converted && canConvert && (
        <Button disabled={pending} onClick={() => setConfirm("convert")}>
          <BuildingIcon data-icon="inline-start" />
          Convert to client
        </Button>
      )}
      <Button variant="secondary" onClick={() => setEditing(true)}>
        <PencilIcon data-icon="inline-start" />
        Edit
      </Button>
      {canDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="More actions" />}>
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <PencilIcon /> Edit details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setConfirm("delete")}>
              <Trash2Icon /> Delete lead
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl!">
          <SheetHeader>
            <SheetTitle>Edit lead</SheetTitle>
            <SheetDescription>{leadName}</SheetDescription>
          </SheetHeader>
          <LeadForm
            key={String(editing)}
            mode="edit"
            leadId={leadId}
            ownerLocked={ownerLocked}
            {...form}
            className="px-4 pb-6"
          />
        </SheetContent>
      </Sheet>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === "convert" ? `Convert ${leadName} to a client?` : `Delete ${leadName}?`}</DialogTitle>
            <DialogDescription>
              {confirm === "convert"
                ? "This creates a client record with the lead's contact details and moves the lead to Won. Projects, invoices and the client portal build on it."
                : "The lead, its notes and follow-ups are permanently deleted. The audit log keeps a record that it existed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
            <Button
              variant={confirm === "delete" ? "destructive" : "default"}
              disabled={pending}
              onClick={() => {
                const action = confirm
                setConfirm(null)
                startTransition(async () => {
                  if (action === "convert") {
                    const result = await convertLeadToClient(leadId)
                    if (!result.ok) toast.add({ type: "error", title: "Couldn't convert lead", description: result.error })
                    else {
                      toast.add({ type: "success", title: result.message ?? "Converted" })
                      router.refresh()
                    }
                  }
                  if (action === "delete") {
                    const result = await deleteLead(leadId)
                    if (result && !result.ok) toast.add({ type: "error", title: "Couldn't delete lead", description: result.error })
                  }
                })
              }}
            >
              {confirm === "convert" ? "Convert to client" : "Delete lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { LeadActions }
