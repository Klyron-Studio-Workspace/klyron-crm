"use client"

import { BuildingIcon, GlobeIcon, MailIcon, PhoneIcon, UserRoundIcon } from "lucide-react"
import { useActionState } from "react"

import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient, updateClient } from "@/lib/actions/clients"
import type { PersonDTO } from "@/lib/leads/types"
import { cn } from "@/lib/utils"

export type ClientFormValues = {
  name: string
  contactName: string
  email: string
  phone: string
  website: string
  ownerId: string
  notes: string
}

type ClientFormProps = {
  mode: "create" | "edit"
  clientId?: string
  initial: ClientFormValues
  members: PersonDTO[]
  footer?: React.ReactNode
  className?: string
}

function ClientForm({ mode, clientId, initial, members, footer, className }: ClientFormProps) {
  const [state, action, pending] = useActionState(mode === "create" ? createClient : updateClient, undefined)
  const errors = state?.fieldErrors
  const v = state?.values ? { ...initial, ...state.values } : initial

  return (
    <form action={action} noValidate className={cn("flex flex-col gap-5", className)}>
      {clientId && <input type="hidden" name="clientId" value={clientId} />}
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state?.ok && state.message && <FormAlert tone="success">{state.message}</FormAlert>}
      <div key={JSON.stringify(state?.values ?? initial)} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Client name" icon={BuildingIcon} name="name" defaultValue={v.name} required autoComplete="off" hint="Company or person" errors={errors?.name} />
          <FormField label="Main contact" icon={UserRoundIcon} optional hint="Who you usually deal with." name="contactName" defaultValue={v.contactName} autoComplete="off" errors={errors?.contactName} />
          <FormField label="Email" icon={MailIcon} optional hint="Invoices and proposals are emailed here." name="email" type="email" defaultValue={v.email} autoComplete="off" errors={errors?.email} />
          <FormField label="Phone" icon={PhoneIcon} optional name="phone" type="tel" defaultValue={v.phone} autoComplete="off" errors={errors?.phone} />
          <FormField label="Website" icon={GlobeIcon} optional name="website" defaultValue={v.website} placeholder="example.com" autoComplete="off" errors={errors?.website} />
          <SelectField
            label="Account owner"
            name="ownerId"
            id={`${mode}-client-owner`}
            value={v.ownerId || "none"}
            items={[{ value: "none", label: "Unassigned" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
            error={errors?.ownerId?.[0]}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${mode}-client-notes`}>Notes</Label>
          <Textarea id={`${mode}-client-notes`} name="notes" defaultValue={v.notes} placeholder="Preferences, billing details, context for the team…" className="min-h-24" />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        {footer}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create client" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

export { ClientForm }
