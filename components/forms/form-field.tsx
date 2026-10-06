import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type FormFieldProps = React.ComponentProps<typeof Input> & {
  label: string
  name: string
  errors?: string[]
  hint?: React.ReactNode
  /** Rendered next to the label (e.g. a "Forgot password?" link). */
  labelAside?: React.ReactNode
}

function FormField({ label, name, errors, hint, labelAside, id, className, ...props }: FormFieldProps) {
  const fieldId = id ?? `field-${name}`
  const error = errors?.[0]
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={fieldId}>{label}</Label>
        {labelAside}
      </div>
      <Input
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn("h-10", className)}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="text-xs text-primary-strong">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export { FormField }
