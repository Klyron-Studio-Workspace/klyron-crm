"use client"

import * as React from "react"
import { useActionState } from "react"
import { ArchiveIcon, ArchiveRestoreIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { FormAlert } from "@/components/forms/form-alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createService, deleteService, setServiceActive, updateService, updateServicePrice } from "@/lib/actions/pipeline"
import { priceUnitLabels } from "@/lib/finance/constants"
import { cn } from "@/lib/utils"

export type ServiceRow = {
  id: string
  name: string
  description: string | null
  active: boolean
  leadCount: number
  /** "" when unpriced. */
  price: string
  priceUnit: keyof typeof priceUnitLabels
}

const unitItems = Object.entries(priceUnitLabels).map(([value, label]) => ({ value, label }))

function ServiceRowEditor({ service }: { service: ServiceRow }) {
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()
  const [name, setName] = React.useState(service.name)
  const [description, setDescription] = React.useState(service.description ?? "")
  const [price, setPrice] = React.useState(service.price)
  const [priceUnit, setPriceUnit] = React.useState<string>(service.priceUnit)

  function run(task: () => Promise<{ ok: boolean; error?: string }>, revert?: () => void) {
    startTransition(async () => {
      const result = await task()
      if (!result.ok) {
        toast.add({ type: "error", title: "Couldn't update service", description: result.error })
        revert?.()
      }
    })
  }

  function save() {
    if (name.trim() === service.name && description.trim() === (service.description ?? "")) return
    run(
      () => updateService(service.id, { name, description }),
      () => {
        setName(service.name)
        setDescription(service.description ?? "")
      }
    )
  }

  function savePrice(nextUnit = priceUnit) {
    if (price.trim() === service.price && nextUnit === service.priceUnit) return
    run(
      () => updateServicePrice(service.id, { price, priceUnit: nextUnit }),
      () => {
        setPrice(service.price)
        setPriceUnit(service.priceUnit)
      }
    )
  }

  return (
    <li className={cn("flex flex-wrap items-center gap-3 py-3", !service.active && "opacity-60")}>
      <Input
        aria-label="Service name"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-8 w-60"
      />
      <Input
        aria-label={`Description of ${service.name}`}
        placeholder="Short description (optional)"
        value={description}
        maxLength={255}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-8 min-w-48 flex-1"
      />
      <Input
        aria-label={`Price of ${service.name}`}
        placeholder="Price"
        inputMode="decimal"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        onBlur={() => savePrice()}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-8 w-28 text-right tabular-nums"
      />
      <Select
        items={unitItems}
        value={priceUnit}
        onValueChange={(next: string | null) => {
          if (!next) return
          setPriceUnit(next)
          savePrice(next)
        }}
      >
        <SelectTrigger size="sm" aria-label={`Pricing unit for ${service.name}`} className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {unitItems.map((u) => (
            <SelectItem key={u.value} value={u.value}>
              {u.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="w-16 text-xs text-muted-foreground tabular-nums">
        {service.leadCount} {service.leadCount === 1 ? "lead" : "leads"}
      </span>
      {!service.active && <Badge variant="neutral" className="rounded-md">Archived</Badge>}
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={service.active ? `Archive ${service.name}` : `Restore ${service.name}`}
          disabled={pending}
          onClick={() => run(() => setServiceActive(service.id, !service.active))}
        >
          {service.active ? <ArchiveIcon /> : <ArchiveRestoreIcon />}
        </Button>
        {service.leadCount === 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${service.name}`}
            disabled={pending}
            className="text-muted-foreground hover:text-primary-strong"
            onClick={() => run(() => deleteService(service.id))}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
    </li>
  )
}

function ServiceEditor({ services }: { services: ServiceRow[] }) {
  const [state, action, pending] = useActionState(createService, undefined)
  const failed = Boolean(state?.fieldErrors || state?.error)
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col divide-y divide-border">
        {services.map((service) => (
          <ServiceRowEditor key={`${service.id}-${service.name}-${service.description}-${service.active}-${service.price}-${service.priceUnit}`} service={service} />
        ))}
      </ul>
      <form action={action} className="flex flex-col gap-2 border-t border-border pt-5" noValidate>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-service">New service</Label>
            <Input key={failed ? "f" : "n"} id="new-service" name="name" maxLength={80} defaultValue={failed ? state?.values?.name : undefined} className="h-8 w-60" aria-invalid={state?.fieldErrors?.name ? true : undefined} />
          </div>
          <Input key={failed ? "fd" : "nd"} name="description" aria-label="New service description" placeholder="Description (optional)" maxLength={255} defaultValue={failed ? state?.values?.description : undefined} className="h-8 min-w-48 flex-1" />
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            <PlusIcon data-icon="inline-start" />
            Add service
          </Button>
        </div>
        {state?.fieldErrors?.name && <p className="text-xs text-primary-strong">{state.fieldErrors.name[0]}</p>}
        {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      </form>
    </div>
  )
}

export { ServiceEditor }
