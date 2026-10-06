"use client"

import * as React from "react"
import { MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { ClientForm, type ClientFormValues } from "@/components/clients/client-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { deleteClient } from "@/lib/actions/clients"
import type { PersonDTO } from "@/lib/leads/types"

function NewClientDialog({ members, currentUserId }: { members: PersonDTO[]; currentUserId: string }) {
  const [openCount, setOpenCount] = React.useState(0)
  return (
    <Dialog onOpenChange={(open) => open && setOpenCount((n) => n + 1)}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        New client
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
          <DialogDescription>For clients who didn&rsquo;t come through the leads pipeline. Won leads can be converted from their lead page.</DialogDescription>
        </DialogHeader>
        <ClientForm
          key={openCount}
          mode="create"
          members={members}
          initial={{ name: "", contactName: "", email: "", phone: "", website: "", ownerId: currentUserId, notes: "" }}
          footer={<DialogClose render={<Button type="button" variant="secondary" />}>Cancel</DialogClose>}
        />
      </DialogContent>
    </Dialog>
  )
}

function ClientActions({
  clientId,
  clientName,
  canDelete,
  members,
  initial,
}: {
  clientId: string
  clientName: string
  canDelete: boolean
  members: PersonDTO[]
  initial: ClientFormValues
}) {
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()
  const [editing, setEditing] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  return (
    <div className="flex items-center gap-2">
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
              <PencilIcon /> Edit client
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon /> Delete client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl!">
          <SheetHeader>
            <SheetTitle>Edit client</SheetTitle>
            <SheetDescription>{clientName}</SheetDescription>
          </SheetHeader>
          <ClientForm key={String(editing)} mode="edit" clientId={clientId} members={members} initial={initial} className="px-4 pb-6" />
        </SheetContent>
      </Sheet>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {clientName}?</DialogTitle>
            <DialogDescription>
              The client record and its portal accounts are deleted. Clients with projects can&rsquo;t be deleted. The original
              lead, if any, stays in the pipeline.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setConfirmDelete(false)
                startTransition(async () => {
                  const result = await deleteClient(clientId)
                  if (result && !result.ok) toast.add({ type: "error", title: "Couldn't delete client", description: result.error })
                })
              }}
            >
              Delete client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { ClientActions, NewClientDialog }
