"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { echo, fieldErrorsFrom, type FormState } from "@/lib/actions/state"
import { logEvent, userActor } from "@/lib/audit"
import { can, requireTeamUser } from "@/lib/auth/dal"
import { editableRoles, modules } from "@/lib/auth/permissions"
import { db } from "@/lib/db"
import type { Access, Role } from "@/lib/generated/prisma/enums"

const orgSchema = z.object({
  name: z.string().trim().min(1, "Enter the studio name.").max(120),
  website: z.union([z.literal(""), z.url("Enter a full URL, e.g. https://…").max(255)]),
  billingEmail: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("Enter a valid email."))]),
  defaultCurrency: z.enum(["USD", "EUR", "GBP", "PKR", "AED"]),
  membersSeeAssignedOnly: z.literal("on").optional(),
})

export async function updateOrgSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireTeamUser()
  if (!(await can(actor, "settings", "WRITE"))) return { error: "You don't have permission to edit settings." }

  const parsed = orgSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return fieldErrorsFrom(parsed.error, echo(formData, ["name", "website", "billingEmail", "defaultCurrency", "membersSeeAssignedOnly"]))
  }
  const data = {
    name: parsed.data.name,
    website: parsed.data.website || null,
    billingEmail: parsed.data.billingEmail || null,
    defaultCurrency: parsed.data.defaultCurrency,
    membersSeeAssignedOnly: parsed.data.membersSeeAssignedOnly === "on",
  }

  await db.orgSettings.upsert({ where: { id: "org" }, create: { id: "org", ...data }, update: data })
  await logEvent({ actor: userActor(actor), action: "settings.org.update", entity: { type: "org", id: "org" }, metadata: data })
  revalidatePath("/settings")
  return { ok: true, message: "Settings saved." }
}

const permissionSchema = z.object({
  role: z.enum(editableRoles),
  module: z.enum(modules.map((m) => m.key) as [string, ...string[]]),
  access: z.enum(["NONE", "READ", "WRITE"]),
})

/** Owner-only: the permission matrix decides who can do everything else. */
export async function updatePermission(role: Role, module: string, access: Access) {
  const actor = await requireTeamUser()
  if (actor.role !== "OWNER") return { ok: false as const, error: "Only an Owner can change permissions." }

  const parsed = permissionSchema.safeParse({ role, module, access })
  if (!parsed.success) return { ok: false as const, error: "Invalid permission." }

  await db.rolePermission.upsert({
    where: { role_module: { role: parsed.data.role, module: parsed.data.module } },
    create: parsed.data,
    update: { access: parsed.data.access },
  })
  await logEvent({
    actor: userActor(actor),
    action: "settings.permission.update",
    entity: { type: "role", id: parsed.data.role },
    metadata: parsed.data,
  })
  revalidatePath("/settings/permissions")
  return { ok: true as const }
}
