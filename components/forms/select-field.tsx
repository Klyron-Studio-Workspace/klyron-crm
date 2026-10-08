"use client"

import type { LucideIcon } from "lucide-react"

import { FieldHint, FieldLabel } from "@/components/forms/field-label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type SelectFieldProps = {
  label: string
  name: string
  id: string
  value: string
  items: { value: string; label: string }[]
  error?: string
  hint?: React.ReactNode
  icon?: LucideIcon
  optional?: boolean
}

/** Labelled form select that submits with the form. Remounts when `value` changes. */
function SelectField({ label, name, id, value, items, error, hint, icon, optional }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id} icon={icon} optional={optional}>
        {label}
      </FieldLabel>
      <Select key={value} name={name} items={items} defaultValue={value}>
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

export { SelectField }
