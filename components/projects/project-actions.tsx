"use client"

import * as React from "react"
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { ProjectForm, type ProjectFormValues } from "@/components/projects/project-form"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useToast } from "@/components/ui/toast"
import { deleteProject, setProjectStatus } from "@/lib/actions/projects"
import type { PersonDTO, ServiceDTO } from "@/lib/leads/types"
import { projectStatuses, projectStatusLabels, type ProjectStatusKey } from "@/lib/projects/constants"

type ProjectActionsProps = {
  projectId: string
  projectName: string
  status: ProjectStatusKey
  canDelete: boolean
  form: { initial: ProjectFormValues; clients: { id: string; name: string }[]; services: ServiceDTO[]; members: PersonDTO[] }
}

function ProjectActions({ projectId, projectName, status, canDelete, form }: ProjectActionsProps) {
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()
  const [optimisticStatus, setOptimisticStatus] = React.useOptimistic(status)
  const [editing, setEditing] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const items = projectStatuses.map((s) => ({ value: s, label: projectStatusLabels[s] }))

  return (
    <div className="flex items-center gap-2">
      <Select
        items={items}
        value={optimisticStatus}
        disabled={pending}
        onValueChange={(next: ProjectStatusKey | null) => {
          if (!next || next === optimisticStatus) return
          startTransition(async () => {
            setOptimisticStatus(next)
            const result = await setProjectStatus(projectId, next)
            if (!result.ok) toast.add({ type: "error", title: "Couldn't change status", description: result.error })
          })
        }}
      >
        <SelectTrigger aria-label="Project status" className="h-9 min-w-36">
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
              <PencilIcon /> Edit project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon /> Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl!">
          <SheetHeader>
            <SheetTitle>Edit project</SheetTitle>
            <SheetDescription>{projectName}</SheetDescription>
          </SheetHeader>
          <ProjectForm key={String(editing)} mode="edit" projectId={projectId} {...form} className="px-4 pb-6" />
        </SheetContent>
      </Sheet>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {projectName}?</DialogTitle>
            <DialogDescription>
              Its tasks and milestones are permanently deleted and it disappears from the client portal. Consider marking it
              Completed or Cancelled instead.
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
                  const result = await deleteProject(projectId)
                  if (result && !result.ok) toast.add({ type: "error", title: "Couldn't delete project", description: result.error })
                })
              }}
            >
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { ProjectActions }
