"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type SelectFieldProps = {
  label: string
  name: string
  id: string
  value: string
  items: { value: string; label: string }[]
  error?: string
}

/** Labelled form select that submits with the form. Remounts when `value` changes. */
function SelectField({ label, name, id, value, items, error }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
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
      {error && <p className="text-xs text-primary-strong">{error}</p>}
    </div>
  )
}

export { SelectField }
