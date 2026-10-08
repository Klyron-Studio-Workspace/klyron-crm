import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { McpSettings } from "./settings"
import { requireTeamUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"

export const metadata: Metadata = { title: "MCP settings" }

export default async function McpSettingsPage() {
  const user = await requireTeamUser()
  if (user.role !== "OWNER") notFound()
  const org = await db.orgSettings.upsert({ where: { id: "org" }, create: { id: "org" }, update: {}, select: { mcpTokenHash: true, mcpTokenCreatedAt: true } })
  return <McpSettings endpoint={`${(process.env.APP_URL ?? "").replace(/\/$/, "")}/api/mcp`} configured={Boolean(org.mcpTokenHash)} createdAt={org.mcpTokenCreatedAt?.toISOString() ?? null} />
}
