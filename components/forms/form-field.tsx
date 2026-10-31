"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { EyeIcon, EyeOffIcon } from "lucide-react"

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

function FormField({ label, name, errors, hint, icon, optional, labelAside, id, className, required, type, ...props }: FormFieldProps) {
  const fieldId = id ?? `field-${name}`
  const error = errors?.[0]
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
  const isPassword = type === "password"
  const [revealed, setRevealed] = React.useState(false)

  const input = (
    <Input
      id={fieldId}
      name={name}
      required={required}
      type={isPassword ? (revealed ? "text" : "password") : type}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={cn("h-10", isPassword && "pr-9", className)}
      {...props}
    />
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={fieldId} icon={icon} optional={optional} required={required}>
          {label}
        </FieldLabel>
        {labelAside}
      </div>
      {isPassword ? (
        <div className="relative">
          {input}
          <button
            type="button"
            tabIndex={-1}
            aria-label={revealed ? "Hide password" : "Show password"}
            onClick={() => setRevealed((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {revealed ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        </div>
      ) : (
        input
      )}
      <FieldHint id={error ? `${fieldId}-error` : `${fieldId}-hint`} error={error}>
        {hint}
      </FieldHint>
    </div>
  )
}

export { FormField }
