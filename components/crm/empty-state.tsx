import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type EmptyStateProps = {
  title: string
  description: string
  icon?: LucideIcon
  /** A single primary action. */
  action?: React.ReactNode
  className?: string
}

function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-5 flex size-11 items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground">
          <Icon aria-hidden className="size-5" />
        </div>
      )}
      <h2 className="font-serif text-3xl font-medium tracking-normal text-foreground">
        {title}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export { EmptyState }
