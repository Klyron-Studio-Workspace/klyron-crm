import type { LucideIcon } from "lucide-react"

import { FieldHint, FieldLabel } from "@/components/forms/field-label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type FormFieldProps = React.ComponentProps<typeof Input> & {
  label: string
  name: string
  errors?: string[]
  /** One line explaining what the field is for. */
  hint?: React.ReactNode
  icon?: LucideIcon
  /** Shows "(optional)" next to the label. */
  optional?: boolean
  /** Rendered next to the label (e.g. a "Forgot password?" link). */
  labelAside?: React.ReactNode
}

function FormField({ label, name, errors, hint, icon, optional, labelAside, id, className, required, ...props }: FormFieldProps) {
  const fieldId = id ?? `field-${name}`
  const error = errors?.[0]
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={fieldId} icon={icon} optional={optional} required={required}>
          {label}
        </FieldLabel>
        {labelAside}
      </div>
      <Input
        id={fieldId}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn("h-10", className)}
        {...props}
      />
      <FieldHint id={error ? `${fieldId}-error` : `${fieldId}-hint`} error={error}>
        {hint}
      </FieldHint>
    </div>
  )
}

export { FormField }
