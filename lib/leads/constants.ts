// Client-safe constants for the leads module. Also imported by prisma/seed.ts (relative imports only).

export const leadSources = ["MANUAL", "INBOUND", "REFERRAL", "LEADFORGE"] as const
export type LeadSourceKey = (typeof leadSources)[number]

export const sourceLabels: Record<LeadSourceKey, string> = {
  MANUAL: "Manual",
  INBOUND: "Inbound",
  REFERRAL: "Referral",
  LEADFORGE: "LeadForge",
}

export const lostReasons = [
  { value: "budget", label: "Budget" },
  { value: "timing", label: "Timing" },
  { value: "competitor", label: "Chose another vendor" },
  { value: "no_response", label: "Went silent" },
  { value: "not_fit", label: "Not a fit" },
  { value: "other", label: "Other" },
] as const
export type LostReasonKey = (typeof lostReasons)[number]["value"]

export function lostReasonLabel(value: string | null | undefined) {
  return lostReasons.find((r) => r.value === value)?.label ?? value ?? ""
}

export const noteTypes = ["NOTE", "CALL", "MEETING", "EMAIL"] as const
export type NoteTypeKey = (typeof noteTypes)[number]

export const noteTypeLabels: Record<NoteTypeKey, string> = {
  NOTE: "Note",
  CALL: "Call",
  MEETING: "Meeting",
  EMAIL: "Email",
}

export const currencies = ["USD", "EUR", "GBP", "PKR", "AED"] as const
export type CurrencyCode = (typeof currencies)[number]

export const stageTones = ["NEUTRAL", "INFO", "WARNING", "BRAND", "SUCCESS"] as const
export type StageToneKey = (typeof stageTones)[number]

export const stageToneLabels: Record<StageToneKey, string> = {
  NEUTRAL: "Gray",
  INFO: "Blue",
  WARNING: "Amber",
  BRAND: "Crimson",
  SUCCESS: "Green",
}

export const defaultStages = [
  { name: "Lead", kind: "OPEN", tone: "NEUTRAL" },
  { name: "Contacted", kind: "OPEN", tone: "INFO" },
  { name: "Qualified", kind: "OPEN", tone: "INFO" },
  { name: "Proposal", kind: "OPEN", tone: "WARNING" },
  { name: "Negotiation", kind: "OPEN", tone: "BRAND" },
  { name: "Won", kind: "WON", tone: "SUCCESS" },
  { name: "Lost", kind: "LOST", tone: "NEUTRAL" },
] as const

/** From klyronstudio.com, "What we build". Edit in Settings → Services. */
export const defaultServices = [
  "Web App Development",
  "Mobile Applications",
  "SaaS Product Engineering",
  "CRM & ERP Solutions",
  "Dashboards & Analytics",
  "API Development",
  "DevOps & Cloud Scale",
  "UI/UX Design Systems",
  "Bug Fixing",
  "Maintenance & Support",
  "Digital Marketing",
  "Graphic Design & Video Editing",
] as const
