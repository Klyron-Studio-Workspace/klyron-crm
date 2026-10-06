"use client"

import { useActionState } from "react"

import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createProject, updateProject } from "@/lib/actions/projects"
import type { PersonDTO, ServiceDTO } from "@/lib/leads/types"
import { projectStatuses, projectStatusLabels } from "@/lib/projects/constants"
import { cn } from "@/lib/utils"

export type ProjectFormValues = {
  name: string
  description: string
  clientId: string
  serviceId: string
  ownerId: string
  status: string
  startDate: string
  dueDate: string
  memberIds: string[]
}

type ProjectFormProps = {
  mode: "create" | "edit"
  projectId?: string
  initial: ProjectFormValues
  clients: { id: string; name: string }[]
  services: ServiceDTO[]
  members: PersonDTO[]
  /** Fix the client (creating from a client page). */
  clientLocked?: boolean
  footer?: React.ReactNode
  className?: string
}

function ProjectForm({ mode, projectId, initial, clients, services, members, clientLocked, footer, className }: ProjectFormProps) {
  const [state, action, pending] = useActionState(mode === "create" ? createProject : updateProject, undefined)
  const errors = state?.fieldErrors
  const echoed = state?.values
  const v: ProjectFormValues = echoed
    ? {
        name: echoed.name ?? "",
        description: echoed.description ?? "",
        clientId: echoed.clientId ?? initial.clientId,
        serviceId: echoed.serviceId ?? "",
        ownerId: echoed.ownerId ?? "",
        status: echoed.status ?? initial.status,
        startDate: echoed.startDate ?? "",
        dueDate: echoed.dueDate ?? "",
        memberIds: (echoed.memberIds ?? "").split(",").filter(Boolean),
      }
    : initial
  const selected = new Set(v.memberIds)

  return (
    <form action={action} noValidate className={cn("flex flex-col gap-5", className)}>
      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state?.ok && state.message && <FormAlert tone="success">{state.message}</FormAlert>}

      {/* Remount inputs after a failed submit (React resets forms after actions). */}
      <div key={JSON.stringify(echoed ?? initial)} className="flex flex-col gap-5">
        <FormField label="Project name" name="name" defaultValue={v.name} required autoComplete="off" errors={errors?.name} />
        <div className="grid gap-4 sm:grid-cols-2">
          {clientLocked ? (
            <input type="hidden" name="clientId" value={v.clientId} />
          ) : (
            <SelectField
              label="Client"
              name="clientId"
              id={`${mode}-project-client`}
              value={v.clientId}
              items={clients.map((c) => ({ value: c.id, label: c.name }))}
              error={errors?.clientId?.[0]}
            />
          )}
          <SelectField
            label="Service"
            name="serviceId"
            id={`${mode}-project-service`}
            value={v.serviceId || "none"}
            items={[{ value: "none", label: "None" }, ...services.map((s) => ({ value: s.id, label: s.name }))]}
          />
          <SelectField
            label="Status"
            name="status"
            id={`${mode}-project-status`}
            value={v.status}
            items={projectStatuses.map((s) => ({ value: s, label: projectStatusLabels[s] }))}
          />
          <SelectField
            label="Project lead"
            name="ownerId"
            id={`${mode}-project-owner`}
            value={v.ownerId || "none"}
            items={[{ value: "none", label: "No lead" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
            error={errors?.ownerId?.[0]}
          />
          <FormField label="Start date" name="startDate" type="date" defaultValue={v.startDate} errors={errors?.startDate} />
          <FormField label="Deadline" name="dueDate" type="date" defaultValue={v.dueDate} errors={errors?.dueDate} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${mode}-project-description`}>Brief</Label>
          <Textarea
            id={`${mode}-project-description`}
            name="description"
            defaultValue={v.description}
            placeholder="Goals, scope and anything the team should know."
            className="min-h-28"
          />
        </div>

        {members.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Team on this project</legend>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <label
                  key={member.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm transition-colors duration-150 ease-out hover:bg-surface has-checked:border-primary/40 has-checked:bg-primary-tint has-checked:text-primary-strong has-focus-visible:ring-2 has-focus-visible:ring-ring"
                >
                  <input type="checkbox" name="memberIds" value={member.id} defaultChecked={selected.has(member.id)} className="sr-only" />
                  {member.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {footer}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create project" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

export { ProjectForm }
