import { Badge } from "@/components/ui/badge"
import type { StageToneKey } from "@/lib/leads/constants"
import { cn } from "@/lib/utils"

const variant = {
  NEUTRAL: "neutral",
  INFO: "info",
  WARNING: "warning",
  BRAND: "brand",
  SUCCESS: "success",
} as const satisfies Record<StageToneKey, string>

const dot: Record<StageToneKey, string> = {
  NEUTRAL: "bg-muted-foreground",
  INFO: "bg-info",
  WARNING: "bg-warning",
  BRAND: "bg-primary",
  SUCCESS: "bg-success",
}

/** Pipeline stage pill. Soft tint + matching text; color comes from the stage's tone setting. */
function StageBadge({
  name,
  tone,
  muted,
  className,
}: {
  name: string
  tone: StageToneKey
  /** Dim the label (used for Lost). */
  muted?: boolean
  className?: string
}) {
  return (
    <Badge variant={variant[tone]} className={cn("gap-1.5 rounded-md", muted && "text-muted-foreground", className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", dot[tone])} />
      {name}
    </Badge>
  )
}

export { StageBadge }
