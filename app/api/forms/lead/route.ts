import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logEvent, systemActor } from "@/lib/audit"
import { db } from "@/lib/db"
import { getOrgSettings, getStages } from "@/lib/leads/queries"
import { notify } from "@/lib/notifications"
import { getRequestInfo } from "@/lib/request"

/**
 * Website contact form → new lead in the first open pipeline stage.
 * Works as a plain HTML form POST (redirects to `_next`, or shows a thank-you page)
 * or as fetch() with JSON. Enabled and keyed in Settings → Website form.
 */

// Any site may post; the form key is what gates it.
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)

const formSchema = z.object({
  key: z.string().min(1),
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email.")).pipe(z.string().max(254)),
  company: optional(120),
  phone: optional(40),
  website: optional(255),
  message: optional(5000),
})

// ponytail: in-memory per-IP limit, fine for the single app process; move to the DB if you scale out.
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5
const recent = new Map<string, number[]>()

function throttled(ip: string | null) {
  if (!ip) return false
  const now = Date.now()
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (hits.length >= MAX_PER_WINDOW) return true
  recent.set(ip, [...hits, now])
  return false
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors })
}

export async function POST(request: Request) {
  const isJson = request.headers.get("content-type")?.includes("application/json") ?? false
  let fields: Record<string, unknown>
  try {
    fields = isJson ? await request.json() : Object.fromEntries(await request.formData())
  } catch {
    return reply(request, isJson, 400, "Invalid form data.")
  }
  const key = new URL(request.url).searchParams.get("key") ?? fields.key

  const org = await getOrgSettings()
  if (!org.leadFormKey || key !== org.leadFormKey) return reply(request, isJson, 404, "This form is not accepting submissions.")

  // Honeypot: a hidden field real visitors leave empty. Bots get a fake success.
  if (typeof fields._gotcha === "string" && fields._gotcha) return reply(request, isJson, 200, null, fields._next)

  const { ipAddress } = await getRequestInfo()
  if (throttled(ipAddress)) return reply(request, isJson, 429, "Too many submissions. Please try again later.")

  const parsed = formSchema.safeParse({ ...fields, key })
  if (!parsed.success) return reply(request, isJson, 400, parsed.error.issues[0]?.message ?? "Please check the form.")
  const { name, email, company, phone, website, message } = parsed.data

  const stage = (await getStages()).find((s) => s.kind === "OPEN")
  if (!stage) return reply(request, isJson, 503, "The form is temporarily unavailable.")
  const last = await db.lead.findFirst({ where: { stageId: stage.id }, orderBy: { position: "desc" }, select: { position: true } })

  const lead = await db.lead.create({
    data: {
      name,
      email,
      company,
      phone,
      website,
      source: "INBOUND",
      currency: org.defaultCurrency,
      stageId: stage.id,
      position: (last?.position ?? 0) + 1,
      notes: message ? { create: { body: `Website form message:\n\n${message}`, authorName: "Website form" } } : undefined,
    },
  })
  await logEvent({
    actor: systemActor,
    action: "lead.create",
    entity: { type: "lead", id: lead.id },
    metadata: { name, company, stage: stage.name, source: "website-form", ipAddress },
  })
  const admins = await db.user.findMany({ where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } }, select: { id: true } })
  await notify({
    userIds: admins.map((u) => u.id),
    type: "lead.inbound",
    title: `New website lead: ${company ?? name}`,
    body: message?.slice(0, 200) ?? email,
    link: `/leads/${lead.id}`,
    email: "always",
  })
  revalidatePath("/leads")

  return reply(request, isJson, 200, null, fields._next)
}

/** JSON for fetch(); for HTML forms, redirect back to the site or show a simple page. */
function reply(request: Request, isJson: boolean, status: number, error: string | null, next?: unknown) {
  if (isJson) return Response.json(error ? { ok: false, error } : { ok: true }, { status, headers: cors })

  // Only redirect to the site the form was posted from (no open redirect).
  if (!error && typeof next === "string") {
    try {
      const target = new URL(next)
      const from = request.headers.get("origin") ?? request.headers.get("referer")
      if (from && new URL(from).origin === target.origin && /^https?:$/.test(target.protocol)) {
        return Response.redirect(target, 303)
      }
    } catch {}
  }

  const text = error ?? "Thanks! We got your message and will be in touch soon."
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${error ? "Something went wrong" : "Thank you"}</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;color:#0a0a0a"><p style="max-width:420px;text-align:center;line-height:1.6">${text.replace(/[<>&]/g, "")}${error ? '<br><a href="javascript:history.back()">Go back</a>' : ""}</p></body>`
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } })
}
