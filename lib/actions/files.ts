"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logEvent, userActor } from "@/lib/audit"
import { can, requireTeamUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"

type Result = { ok: true } | { ok: false; error: string }

const detailsSchema = z.object({
  folder: z
    .string()
    .transform((v) => v.replace(/[/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || null),
  restricted: z.boolean(),
})

/** Moves a company document to another folder and/or changes who can see it. */
export async function updateCompanyFile(fileId: string, input: { folder: string; restricted: boolean }): Promise<Result> {
  const user = await requireTeamUser()
  if (!(await can(user, "files", "WRITE"))) return { ok: false, error: "You don't have permission to edit documents." }
  const parsed = detailsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Check the folder name." }
  const file = await db.storedFile.findUnique({ where: { id: fileId } })
  const isAdmin = user.role === "OWNER" || user.role === "ADMIN"
  if (!file || !file.company || (file.restricted && !isAdmin)) return { ok: false, error: "Document not found." }
  if (parsed.data.restricted !== file.restricted && !isAdmin) return { ok: false, error: "Only Owners and Admins can change who sees a document." }
  if (file.uploadedById !== user.id && !isAdmin) return { ok: false, error: "You can only move documents you uploaded." }

  await db.storedFile.update({ where: { id: fileId }, data: parsed.data })
  await logEvent({
    actor: userActor(user),
    action: "file.update",
    entity: { type: "file", id: fileId },
    metadata: { name: file.name, folder: parsed.data.folder, restricted: parsed.data.restricted },
  })
  revalidatePath("/files")
  return { ok: true }
}
