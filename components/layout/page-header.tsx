import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  description?: string
  /** Right-aligned actions, e.g. a primary button. */
  actions?: React.ReactNode
  /** Editorial serif title for hero moments (dashboard welcome, etc.). */
  editorial?: boolean
  className?: string
}

function PageHeader({
  title,
  description,
  actions,
  editorial = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1
          className={cn(
            "text-foreground",
            editorial
              ? "font-serif text-4xl font-medium tracking-normal"
              : "font-heading text-2xl font-semibold tracking-tight"
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}

export { PageHeader }
