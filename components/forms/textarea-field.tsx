import type { LucideIcon } from "lucide-react"

import { FieldHint, FieldLabel } from "@/components/forms/field-label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type TextareaFieldProps = React.ComponentProps<typeof Textarea> & {
  label: string
  name: string
  hint?: React.ReactNode
  icon?: LucideIcon
  optional?: boolean
  error?: string
}

/** Labelled multi-line field with icon and helper text. */
function TextareaField({ label, name, hint, icon, optional, error, id, className, ...props }: TextareaFieldProps) {
  const fieldId = id ?? `field-${name}`
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={fieldId} icon={icon} optional={optional}>
        {label}
      </FieldLabel>
      <Textarea
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fieldId}-hint` : undefined}
        className={cn("min-h-20", className)}
        {...props}
      />
      <FieldHint id={`${fieldId}-hint`} error={error}>
        {hint}
      </FieldHint>
    </div>
  )
}

export { TextareaField }
