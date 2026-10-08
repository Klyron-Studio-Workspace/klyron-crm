"use client"

import type { LucideIcon } from "lucide-react"

import { FieldHint, FieldLabel } from "@/components/forms/field-label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type ChoiceFieldProps = {
  label: string
  /** Submitted with the form when set. */
  name?: string
  id: string
  value: string
  onChange: (value: string) => void
  items: { value: string; label: string }[]
  error?: string
  hint?: React.ReactNode
  icon?: LucideIcon
  optional?: boolean
  disabled?: boolean
  className?: string
}

/** Controlled labelled select, for forms whose fields depend on each other. */
function ChoiceField({ label, name, id, value, onChange, items, error, hint, icon, optional, disabled, className }: ChoiceFieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <FieldLabel htmlFor={id} icon={icon} optional={optional}>
        {label}
      </FieldLabel>
      <Select name={name} items={items} value={value} onValueChange={(next: string | null) => next != null && onChange(next)} disabled={disabled}>
        <SelectTrigger id={id} className="h-10! w-full" aria-invalid={error ? true : undefined}>
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
      <FieldHint error={error}>{hint}</FieldHint>
    </div>
  )
}

export { ChoiceField }
