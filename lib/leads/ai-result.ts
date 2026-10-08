import { z } from "zod"

const insightSchema = z.object({
  score: z.number().int().min(0).max(100),
  rationale: z.array(z.string().trim().min(1)).min(1).max(5),
  next_step: z.string().trim().min(1),
  follow_up: z.string().trim().min(1),
})

export type LeadInsights = {
  score: number
  rationale: string[]
  nextStep: string
  followUp: string
}

export function parseLeadInsights(raw: string): LeadInsights {
  const parsed = insightSchema.parse(JSON.parse(raw))
  return {
    score: parsed.score,
    rationale: parsed.rationale.map((reason) => reason.slice(0, 300)),
    nextStep: parsed.next_step.slice(0, 500),
    followUp: parsed.follow_up.slice(0, 3000),
  }
}
