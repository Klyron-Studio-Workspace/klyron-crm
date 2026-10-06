import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { can, requireTeamUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { OrgSettingsForm } from "./org-settings-form"

export const metadata: Metadata = { title: "Settings" }

export default async function GeneralSettingsPage() {
  const user = await requireTeamUser()
  if (!(await can(user, "settings", "READ"))) redirect("/settings/security")

  const org = await db.orgSettings.upsert({ where: { id: "org" }, create: { id: "org" }, update: {} })
  const canEdit = await can(user, "settings", "WRITE")

  return (
    <OrgSettingsForm
      canEdit={canEdit}
      values={{
        name: org.name,
        website: org.website,
        billingEmail: org.billingEmail,
        defaultCurrency: org.defaultCurrency,
        membersSeeAssignedOnly: org.membersSeeAssignedOnly,
      }}
    />
  )
}
