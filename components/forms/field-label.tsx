import type { LucideIcon } from "lucide-react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type FieldLabelProps = {
  htmlFor?: string
  children: React.ReactNode
  /** Small icon before the label, so fields are recognisable at a glance. */
  icon?: LucideIcon
  /** Marks the field as optional without cluttering the label text. */
  optional?: boolean
  required?: boolean
  className?: string
}

/** Field label with an optional icon and an "Optional"/required marker. */
function FieldLabel({ htmlFor, children, icon: Icon, optional, required, className }: FieldLabelProps) {
  return (
    <Label htmlFor={htmlFor} className={cn("gap-1.5", className)}>
      {Icon && <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />}
      <span>{children}</span>
      {required && (
        <span aria-hidden className="text-primary">
          *
        </span>
      )}
      {optional && <span className="text-xs font-normal text-muted-foreground">(optional)</span>}
    </Label>
  )
}

/** Helper text under a field. Errors replace it. */
function FieldHint({ id, error, children }: { id?: string; error?: string; children?: React.ReactNode }) {
  if (error) {
    return (
      <p id={id} className="text-xs text-primary-strong">
        {error}
      </p>
    )
  }
  if (!children) return null
  return (
    <p id={id} className="text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  )
}

export { FieldHint, FieldLabel }
