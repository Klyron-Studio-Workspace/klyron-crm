"use client"

import { BanknoteIcon, BuildingIcon, CoinsIcon, GlobeIcon, KanbanSquareIcon, MailIcon, PhoneIcon, RadarIcon, UserCheckIcon, UserRoundIcon } from "lucide-react"
import { useActionState } from "react"

import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import { createLead, updateLead } from "@/lib/actions/leads"
import { currencies, leadSources, sourceLabels } from "@/lib/leads/constants"
import type { PersonDTO, ServiceDTO, StageDTO } from "@/lib/leads/types"
import { cn } from "@/lib/utils"

export type LeadFormValues = {
  name: string
  company: string
  email: string
  phone: string
  website: string
  source: string
  value: string
  currency: string
  ownerId: string
  stageId: string
  serviceIds: string[]
}

type LeadFormProps = {
  mode: "create" | "edit"
  leadId?: string
  initial: LeadFormValues
  stages: StageDTO[]
  members: PersonDTO[]
  services: ServiceDTO[]
  /** Hide the owner picker (members who only see their own leads). */
  ownerLocked?: boolean
  footer?: React.ReactNode
  className?: string
}


function LeadForm({ mode, leadId, initial, stages, members, services, ownerLocked, footer, className }: LeadFormProps) {
  const [state, action, pending] = useActionState(mode === "create" ? createLead : updateLead, undefined)
  const errors = state?.fieldErrors
  // After a failed submit, show what the user typed (React resets forms after actions).
  const v = state?.values ? { ...initial, ...state.values } : initial
  const selectedServices = new Set(
    state?.values ? (state.values.serviceIds ?? "").split(",").filter(Boolean) : initial.serviceIds
  )

  return (
    <form action={action} noValidate className={cn("flex flex-col gap-5", className)}>
      {leadId && <input type="hidden" name="leadId" value={leadId} />}
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state?.ok && state.message && <FormAlert tone="success">{state.message}</FormAlert>}

      {/* Remount inputs after a failed submit so they show the echoed values. */}
      <div key={JSON.stringify(state?.values ?? initial)} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Contact name" icon={UserRoundIcon} hint="The person you're talking to." name="name" defaultValue={v.name} required autoComplete="off" errors={errors?.name} />
        <FormField label="Company" icon={BuildingIcon} optional hint="Their business, if any." name="company" defaultValue={v.company} autoComplete="off" errors={errors?.company} />
        <FormField label="Email" icon={MailIcon} optional name="email" type="email" defaultValue={v.email} autoComplete="off" errors={errors?.email} />
        <FormField label="Phone" icon={PhoneIcon} optional name="phone" type="tel" defaultValue={v.phone} autoComplete="off" errors={errors?.phone} />
        <FormField label="Website" icon={GlobeIcon} optional name="website" defaultValue={v.website} placeholder="example.com" autoComplete="off" errors={errors?.website} />
        <SelectField
          label="Source" icon={RadarIcon} hint="How they found you, for tracking what works."
          name="source"
          id={`${mode}-source`}
          value={v.source}
          items={leadSources.map((s) => ({ value: s, label: sourceLabels[s] }))}
          error={errors?.source?.[0]}
        />
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <FormField label="Deal value" icon={CoinsIcon} hint="What the work is roughly worth. Feeds the pipeline totals." name="value" type="number" inputMode="decimal" min={0} step="any" defaultValue={v.value} errors={errors?.value} />
          <SelectField
            label="Currency" icon={BanknoteIcon}
            name="currency"
            id={`${mode}-currency`}
            value={v.currency}
            items={currencies.map((c) => ({ value: c, label: c }))}
          />
        </div>
        {ownerLocked ? (
          <input type="hidden" name="ownerId" value={v.ownerId} />
        ) : (
          <SelectField
            label="Owner" icon={UserCheckIcon} hint="Who on the team follows this lead up."
            name="ownerId"
            id={`${mode}-owner`}
            value={v.ownerId || "none"}
            items={[{ value: "none", label: "Unassigned" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
            error={errors?.ownerId?.[0]}
          />
        )}
        {mode === "create" && (
          <SelectField
            label="Stage" icon={KanbanSquareIcon} hint="Where the lead starts on the board."
            name="stageId"
            id="create-stage"
            value={v.stageId}
            items={stages.filter((s) => s.kind !== "LOST").map((s) => ({ value: s.id, label: s.name }))}
          />
        )}
      </div>

      {services.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Services interested in</legend>
          <div className="flex flex-wrap gap-2">
            {services.map((service) => (
              <label
                key={service.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm transition-colors duration-150 ease-out hover:bg-surface has-checked:border-primary/40 has-checked:bg-primary-tint has-checked:text-primary-strong has-focus-visible:ring-2 has-focus-visible:ring-ring"
              >
                <input
                  type="checkbox"
                  name="serviceIds"
                  value={service.id}
                  defaultChecked={selectedServices.has(service.id)}
                  className="sr-only"
                />
                {service.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {footer}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create lead" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

export { LeadForm }
