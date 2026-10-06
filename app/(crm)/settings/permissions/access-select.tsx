"use client"

import { useOptimistic, useTransition } from "react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import { updatePermission } from "@/lib/actions/settings"
import type { Access, Role } from "@/lib/generated/prisma/enums"
import { cn } from "@/lib/utils"

const items: { value: Access; label: string }[] = [
  { value: "NONE", label: "No access" },
  { value: "READ", label: "View" },
  { value: "WRITE", label: "Edit" },
]

const tone: Record<Access, string> = {
  NONE: "text-muted-foreground",
  READ: "text-foreground",
  WRITE: "text-foreground font-medium",
}

function AccessSelect({
  role,
  module,
  value,
  label,
}: {
  role: Role
  module: string
  value: Access
  label: string
}) {
  const toast = useToast()
  const [, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(value)

  return (
    <Select
      items={items}
      value={optimistic}
      onValueChange={(next: Access | null) => {
        if (!next || next === optimistic) return
        startTransition(async () => {
          setOptimistic(next)
          const result = await updatePermission(role, module, next)
          if (!result.ok) toast.add({ type: "error", title: "Couldn't save permission", description: result.error })
        })
      }}
    >
      <SelectTrigger size="sm" aria-label={label} className={cn("w-32", tone[optimistic])}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { AccessSelect }
