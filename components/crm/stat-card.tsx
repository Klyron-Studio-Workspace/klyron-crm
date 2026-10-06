import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type StatCardProps = {
  label: string
  value: string
  delta?: string
  /** Direction of the change. `positive` controls color, not the arrow. */
  trend?: "up" | "down"
  positive?: boolean
  hint?: string
  className?: string
}

function StatCard({
  label,
  value,
  delta,
  trend = "up",
  positive = true,
  hint,
  className,
}: StatCardProps) {
  const TrendIcon = trend === "up" ? ArrowUpRightIcon : ArrowDownRightIcon
  return (
    <div
      data-slot="stat-card"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {(delta || hint) && (
        <div className="flex items-center gap-2 text-xs">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 font-medium tabular-nums",
                positive
                  ? "bg-success-tint text-success"
                  : "bg-destructive-tint text-primary-strong"
              )}
            >
              <TrendIcon aria-hidden className="size-3" />
              {delta}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  )
}

export { StatCard }
