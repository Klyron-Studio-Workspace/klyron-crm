import { z } from "zod"

const schema = z.object({
  status_summary: z.string().trim().min(1),
  health: z.enum(["ON_TRACK", "AT_RISK", "BLOCKED"]),
  risks: z.array(z.object({ risk: z.string().trim().min(1), action: z.string().trim().min(1) })).max(6),
})

export type ProjectInsights = {
  summary: string
  health: "ON_TRACK" | "AT_RISK" | "BLOCKED"
  risks: { risk: string; action: string }[]
}

export function parseProjectInsights(raw: string): ProjectInsights {
  const value = schema.parse(JSON.parse(raw))
  return {
    summary: value.status_summary.slice(0, 3000),
    health: value.health,
    risks: value.risks.map((item) => ({ risk: item.risk.slice(0, 500), action: item.action.slice(0, 500) })),
  }
}
