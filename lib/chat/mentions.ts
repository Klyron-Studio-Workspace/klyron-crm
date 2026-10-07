// Client-safe mention format, stored inside the message body:
//   @[Sara Khan](user:<id>)     a person
//   @[brief.pdf](file:<id>)     a file
//   @[Klyron AI](ai)            ask the AI assistant
// The composer shows "@Sara Khan" while typing and converts on send.

export type MentionKind = "user" | "file" | "ai"
export type Mention = { kind: MentionKind; id: string | null; label: string }
export type MentionOption = Mention & { hint?: string }

export const AI_LABEL = "Klyron AI"

const TOKEN = /@\[([^\]\n]{1,120})\]\((user|file):([A-Za-z0-9_-]{1,64})\)|@\[([^\]\n]{1,120})\]\(ai\)/g

/** Labels can't contain the characters that delimit a token. */
export const cleanLabel = (label: string) => label.replace(/[[\]()\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)

export function toToken(m: Mention) {
  const label = cleanLabel(m.label)
  return m.kind === "ai" ? `@[${label}](ai)` : `@[${label}](${m.kind}:${m.id})`
}

export type BodyPart = { type: "text"; text: string } | { type: "mention"; mention: Mention }

export function parseBody(body: string): BodyPart[] {
  const parts: BodyPart[] = []
  let last = 0
  for (const match of body.matchAll(TOKEN)) {
    if (match.index > last) parts.push({ type: "text", text: body.slice(last, match.index) })
    if (match[4] !== undefined) parts.push({ type: "mention", mention: { kind: "ai", id: null, label: match[4] } })
    else parts.push({ type: "mention", mention: { kind: match[2] as "user" | "file", id: match[3], label: match[1] } })
    last = match.index + match[0].length
  }
  if (last < body.length) parts.push({ type: "text", text: body.slice(last) })
  return parts
}

export function mentionsIn(body: string): Mention[] {
  return parseBody(body).flatMap((p) => (p.type === "mention" ? [p.mention] : []))
}

/** "@Sara Khan can you check @brief.pdf" — for previews, notifications and the AI. */
export function plainText(body: string) {
  return parseBody(body)
    .map((p) => (p.type === "text" ? p.text : `@${p.mention.label}`))
    .join("")
}

/**
 * Composer → stored body: every "@Label" the user picked from the menu (and
 * didn't edit afterwards) becomes a token. Longest labels first, so
 * "@Sara Khan" wins over "@Sara".
 */
export function encodeMentions(text: string, picked: Mention[]) {
  const unique = [...new Map(picked.map((m) => [`${m.kind}:${m.id}:${m.label}`, m])).values()].sort((a, b) => b.label.length - a.label.length)
  if (unique.length === 0) return text
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(`(^|[\\s(])@(${unique.map((m) => escape(m.label)).join("|")})(?=$|[\\s.,!?;:)])`, "g")
  return text.replace(pattern, (_all, before: string, label: string) => {
    const mention = unique.find((m) => m.label === label)
    return mention ? `${before}${toToken(mention)}` : _all
  })
}

/** Stored body → composer text (for editing a message). */
export function decodeMentions(body: string): { text: string; mentions: Mention[] } {
  return { text: plainText(body), mentions: mentionsIn(body) }
}
