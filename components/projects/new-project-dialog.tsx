"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { ProjectForm } from "@/components/projects/project-form"
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
import type { PersonDTO, ServiceDTO } from "@/lib/leads/types"

type NewProjectDialogProps = {
  clients: { id: string; name: string }[]
  services: ServiceDTO[]
  members: PersonDTO[]
  currentUserId: string
  /** Preselect and lock a client (used on the client page). */
  clientId?: string
  label?: string
  variant?: "default" | "secondary"
}

function NewProjectDialog({ clients, services, members, currentUserId, clientId, label = "New project", variant = "default" }: NewProjectDialogProps) {
  const [openCount, setOpenCount] = React.useState(0)
  return (
    <Dialog onOpenChange={(open) => open && setOpenCount((n) => n + 1)}>
      <DialogTrigger render={<Button variant={variant} />}>
        <PlusIcon data-icon="inline-start" />
        {label}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Add milestones and tasks once it&rsquo;s created.</DialogDescription>
        </DialogHeader>
        <ProjectForm
          key={openCount}
          mode="create"
          clients={clients}
          services={services}
          members={members}
          clientLocked={Boolean(clientId)}
          initial={{
            name: "",
            description: "",
            clientId: clientId ?? clients[0]?.id ?? "",
            serviceId: "",
            ownerId: currentUserId,
            status: "PLANNING",
            startDate: "",
            dueDate: "",
            memberIds: [currentUserId],
          }}
          footer={<DialogClose render={<Button type="button" variant="secondary" />}>Cancel</DialogClose>}
        />
      </DialogContent>
    </Dialog>
  )
}

export { NewProjectDialog }
