"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { LeadForm } from "@/components/leads/lead-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { PersonDTO, ServiceDTO, StageDTO } from "@/lib/leads/types"

type NewLeadDialogProps = {
  stages: StageDTO[]
  members: PersonDTO[]
  services: ServiceDTO[]
  currentUserId: string
  defaultCurrency: string
  ownerLocked: boolean
}

function NewLeadDialog({ stages, members, services, currentUserId, defaultCurrency, ownerLocked }: NewLeadDialogProps) {
  const [openCount, setOpenCount] = React.useState(0)
  const firstOpen = stages.find((s) => s.kind === "OPEN") ?? stages[0]

  return (
    <Dialog onOpenChange={(open) => open && setOpenCount((n) => n + 1)}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        New lead
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
          <DialogDescription>Only the contact name is required. You can fill in the rest later.</DialogDescription>
        </DialogHeader>
        <LeadForm
          key={openCount}
          mode="create"
          stages={stages}
          members={members}
          services={services}
          ownerLocked={ownerLocked}
          initial={{
            name: "",
            company: "",
            email: "",
            phone: "",
            website: "",
            source: "MANUAL",
            value: "",
            currency: defaultCurrency,
            ownerId: currentUserId,
            stageId: firstOpen?.id ?? "",
            serviceIds: [],
          }}
          footer={<DialogClose render={<Button type="button" variant="secondary" />}>Cancel</DialogClose>}
        />
      </DialogContent>
    </Dialog>
  )
}

export { NewLeadDialog }
