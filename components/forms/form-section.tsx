import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type FormSectionProps = {
  icon: LucideIcon
  title: string
  /** One sentence on what this part of the form is for. */
  description?: React.ReactNode
  /** Right-aligned extras, e.g. a button. */
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** A titled group of fields inside a form: icon, title, one-line description, then the fields. */
function FormSection({ icon: Icon, title, description, aside, children, className }: FormSectionProps) {
  return (
    <section className={cn("flex flex-col gap-5", className)}>
      <header className="flex items-start gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary-strong">
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  )
}

export { FormSection }
