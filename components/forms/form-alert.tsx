import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function FormAlert({
  tone,
  children,
  className,
}: {
  tone: "error" | "success"
  children: React.ReactNode
  className?: string
}) {
  const Icon = tone === "error" ? CircleAlertIcon : CircleCheckIcon
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
        tone === "error"
          ? "border-destructive/20 bg-destructive-tint text-primary-strong"
          : "border-success/20 bg-success-tint text-success",
        className
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export { FormAlert }
