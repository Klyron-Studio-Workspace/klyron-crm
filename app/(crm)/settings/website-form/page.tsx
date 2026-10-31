import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { WebsiteFormSettings } from "./settings"
import { can, requireTeamUser } from "@/lib/auth/dal"
import { getOrgSettings } from "@/lib/leads/queries"

export const metadata: Metadata = { title: "Website form" }

export default async function WebsiteFormPage() {
  const user = await requireTeamUser()
  if (!(await can(user, "settings", "WRITE"))) notFound()
  const org = await getOrgSettings()
  const endpoint = `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/api/forms/lead`
  return <WebsiteFormSettings endpoint={endpoint} formKey={org.leadFormKey} />
}
