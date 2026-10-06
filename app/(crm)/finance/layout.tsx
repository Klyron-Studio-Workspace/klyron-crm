import { PageHeader } from "@/components/layout/page-header"
import { SettingsNav, type SettingsTab } from "@/components/layout/settings-nav"
import { requirePermission } from "@/lib/auth/dal"

const tabs: SettingsTab[] = [
  { href: "/finance", label: "Overview" },
  { href: "/finance/invoices", label: "Invoices", exact: false },
  { href: "/finance/proposals", label: "Proposals", exact: false },
  { href: "/finance/expenses", label: "Expenses" },
]

export default async function FinanceLayout({ children }: LayoutProps<"/finance">) {
  await requirePermission("finance", "READ")
  return (
    <>
      <div className="flex flex-col gap-6 print:hidden">
        <PageHeader title="Finance" description="Proposals, invoices, payments and expenses." />
        <SettingsNav tabs={tabs} label="Finance" />
      </div>
      {children}
    </>
  )
}
