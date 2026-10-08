import { PageHeader } from "@/components/layout/page-header"
import { SettingsNav, type SettingsTab } from "@/components/layout/settings-nav"
import { can, requireTeamUser } from "@/lib/auth/dal"

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const user = await requireTeamUser()
  const [settings, settingsWrite, team, audit, financeWrite] = await Promise.all([
    can(user, "settings", "READ"),
    can(user, "settings", "WRITE"),
    can(user, "team", "READ"),
    can(user, "audit", "READ"),
    can(user, "finance", "WRITE"),
  ])

  const tabs: SettingsTab[] = [
    ...(settings ? [{ href: "/settings", label: "General" }] : []),
    ...(settingsWrite
      ? [
          { href: "/settings/pipeline", label: "Pipeline" },
          { href: "/settings/services", label: "Services" },
        ]
      : []),
    ...(settingsWrite && financeWrite ? [{ href: "/settings/billing", label: "Billing" }] : []),
    ...(team ? [{ href: "/settings/team", label: "Team" }] : []),
    ...(user.role === "OWNER" ? [{ href: "/settings/permissions", label: "Permissions" }] : []),
    ...(user.role === "OWNER" ? [{ href: "/settings/mcp", label: "MCP" }] : []),
    { href: "/settings/security", label: "Security" },
    ...(audit ? [{ href: "/settings/audit", label: "Audit log" }] : []),
  ]

  return (
    <>
      <div className="flex flex-col gap-6">
        <PageHeader title="Settings" description="Studio profile, team access and account security." />
        <SettingsNav tabs={tabs} />
      </div>
      {children}
    </>
  )
}
