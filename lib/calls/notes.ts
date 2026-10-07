import "server-only"

import Groq from "groq-sdk"
import { z } from "zod"

import { channelAudience } from "@/lib/chat/access"
import { messageInclude, toMessageDTO } from "@/lib/chat/queries"
import { db } from "@/lib/db"
import { notify } from "@/lib/notifications"
import { publish } from "@/lib/realtime/bus"

/** Long calls are trimmed to fit the model's context; the start and end matter most. */
const MAX_TRANSCRIPT_CHARS = 90_000

export function isNotesConfigured() {
  return Boolean(process.env.GROQ_API_KEY)
}

let client: Groq | null = null
function groq() {
  client ??= new Groq({ apiKey: process.env.GROQ_API_KEY })
  return client
}

const notesSchema = z.object({
  summary: z.string().trim().min(1).max(4000),
  decisions: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  action_items: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(500),
        owner: z.string().trim().max(120).nullable().optional(),
        due: z.string().trim().max(60).nullable().optional(),
      })
    )
    .max(50)
    .default([]),
})

const SYSTEM_PROMPT = `You write meeting notes for Klyron Studio, a design and development studio.
You receive a call transcript produced by live speech recognition, so expect misheard words and missing punctuation; infer the intended meaning, never invent facts.
Reply with a JSON object only:
{
  "summary": "3-6 sentences in plain English: purpose, what was discussed, outcome",
  "decisions": ["each decision that was actually agreed"],
  "action_items": [{ "text": "what needs doing", "owner": "person's name as spoken, or null", "due": "deadline as spoken (e.g. 'Friday'), or null" }]
}
Use empty arrays when there are no decisions or action items. Do not include small talk.`

function transcriptText(segments: { speakerName: string; text: string; spokenAt: Date }[], startedAt: Date) {
  const lines = segments.map((s) => {
    const secs = Math.max(0, Math.round((s.spokenAt.getTime() - startedAt.getTime()) / 1000))
    const stamp = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`
    return `[${stamp}] ${s.speakerName}: ${s.text}`
  })
  let text = lines.join("\n")
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    const half = MAX_TRANSCRIPT_CHARS / 2
    text = `${text.slice(0, half)}\n[… middle of the call omitted for length …]\n${text.slice(-half)}`
  }
  return text
}

/** Pushes the updated call card to everyone in the conversation. */
export async function refreshCallCards(callId: string) {
  const messages = await db.message.findMany({ where: { callId }, include: { ...messageInclude, channel: true } })
  for (const m of messages) {
    publish(await channelAudience(m.channel), { type: "message.update", channelId: m.channelId, message: toMessageDTO(m) })
  }
}

/**
 * Generates notes for one ended call. Safe to call more than once: only a call
 * in PENDING is claimed, so overlapping runs never double-bill the API.
 */
export async function generateCallNotes(callId: string) {
  // notesModel doubles as the "in progress" marker while PENDING (reset to null to retry).
  const claimed = await db.call.updateMany({ where: { id: callId, status: "ENDED", notesStatus: "PENDING", notesModel: null }, data: { notesModel: "…" } })
  if (claimed.count === 0) return

  const call = await db.call.findUniqueOrThrow({
    where: { id: callId },
    include: { segments: { orderBy: { spokenAt: "asc" } }, participants: { include: { user: { select: { name: true, role: true } } } } },
  })
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b"
  const fail = async (message: string) => {
    await db.call.update({ where: { id: callId }, data: { notesStatus: "FAILED", notesError: message.slice(0, 500), notesModel: model, notesAt: new Date() } })
    await refreshCallCards(callId)
  }

  if (call.segments.length === 0) {
    await db.call.update({ where: { id: callId }, data: { notesStatus: "NONE", notesModel: null } })
    await refreshCallCards(callId)
    return
  }
  if (!isNotesConfigured()) return fail("AI notes aren't set up yet: add GROQ_API_KEY to .env, then press “Generate notes”.")

  try {
    const completion = await groq().chat.completions.create({
      model,
      temperature: 0.2,
      max_completion_tokens: 4000,
      // Reasoning models (gpt-oss): think briefly, return only the answer.
      reasoning_effort: "low",
      include_reasoning: false,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Call: ${call.title}\nParticipants: ${call.participants.map((p) => p.user.name).join(", ") || "unknown"}\n\nTranscript:\n${transcriptText(call.segments, call.startedAt)}`,
        },
      ],
    })
    const raw = completion.choices[0]?.message?.content ?? ""
    const parsed = notesSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return fail("The AI reply wasn't in the expected format. Try “Generate notes” again.")

    await db.call.update({
      where: { id: callId },
      data: {
        notesStatus: "READY",
        summary: parsed.data.summary,
        decisions: parsed.data.decisions,
        actionItems: parsed.data.action_items.map((a) => ({ text: a.text, owner: a.owner ?? null, due: a.due ?? null })),
        notesModel: completion.model ?? model,
        notesError: null,
        notesAt: new Date(),
      },
    })
    await refreshCallCards(callId)
    for (const portal of [false, true]) {
      await notify({
        userIds: call.participants.filter((p) => (p.user.role === "CLIENT") === portal).map((p) => p.userId),
        type: "call.notes",
        title: `Meeting notes ready: ${call.title}`,
        body: parsed.data.summary.slice(0, 200),
        link: portal ? `/portal/calls/${callId}` : `/calls/${callId}`,
        email: "if-offline",
      })
    }
  } catch (error) {
    const message = error instanceof Groq.APIError ? `Groq error ${error.status ?? ""}: ${error.message}` : error instanceof Error ? error.message : "Unknown error"
    console.error(`[calls] notes for ${callId} failed:`, message)
    await fail(message)
  }
}
