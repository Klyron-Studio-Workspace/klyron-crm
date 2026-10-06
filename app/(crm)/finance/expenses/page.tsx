import type { Metadata } from "next"
import Link from "next/link"
import { WalletIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { formatAmount } from "@/components/finance/document-view"
import { DeleteExpenseButton, ExpenseDialog } from "@/components/finance/expense-dialog"
import { FilterChips } from "@/components/finance/filter-chips"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { can, requirePermission } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { expenseCategoryLabels } from "@/lib/finance/constants"
import { addTo } from "@/lib/finance/math"
import { getOrgBilling, listExpenses, monthKeys, todayKey } from "@/lib/finance/queries"
import { formatDateOnly } from "@/lib/format"
import { formatTotals } from "@/lib/money"

export const metadata: Metadata = { title: "Expenses" }

const monthName = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" })

function lastDayOf(month: string) {
  const [y, m] = month.split("-").map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export default async function ExpensesPage({ searchParams }: PageProps<"/finance/expenses">) {
  const user = await requirePermission("finance", "READ")
  const sp = await searchParams
  const today = todayKey()
  const months = monthKeys(today, 6).reverse()
  const month = typeof sp.month === "string" && (/^\d{4}-\d{2}$/.test(sp.month) || sp.month === "all") ? sp.month : months[0]

  const [expenses, canWrite, org, clients, projects] = await Promise.all([
    listExpenses(month === "all" ? {} : { from: `${month}-01`, to: lastDayOf(month) }),
    can(user, "finance", "WRITE"),
    getOrgBilling(),
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, clientId: true } }),
  ])
  const options = { clients, projects, defaultCurrency: org.defaultCurrency, today }

  const total: Record<string, number> = {}
  const byCategory = new Map<string, Record<string, number>>()
  for (const e of expenses) {
    addTo(total, e.currency, e.amount)
    const bucket = byCategory.get(e.category) ?? {}
    addTo(bucket, e.currency, e.amount)
    byCategory.set(e.category, bucket)
  }

  const chips = [
    ...months.map((m) => ({ label: monthName.format(new Date(`${m}-01T00:00:00Z`)), href: `/finance/expenses?month=${m}`, active: month === m })),
    { label: "All time", href: "/finance/expenses?month=all", active: month === "all" },
  ]
  if (month !== "all" && !months.includes(month)) chips.unshift({ label: monthName.format(new Date(`${month}-01T00:00:00Z`)), href: `/finance/expenses?month=${month}`, active: true })

  return (
    <section aria-label="Expenses" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips label="Expense period" chips={chips} />
        {canWrite && <ExpenseDialog options={options} />}
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={WalletIcon} title="No expenses for this period." description="Log software, contractors and other costs to see real profit on the overview." />
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-5 py-4 text-sm">
            <p>
              <span className="text-muted-foreground">Total</span> <span className="font-semibold tabular-nums">{formatTotals(total)}</span>
            </p>
            {[...byCategory.entries()].map(([category, totals]) => (
              <p key={category}>
                <span className="text-muted-foreground">{expenseCategoryLabels[category as keyof typeof expenseCategoryLabels]}</span>{" "}
                <span className="tabular-nums">{formatTotals(totals)}</span>
              </p>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Expense</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>For</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {canWrite && <TableHead className="w-20"><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{formatDateOnly(e.spentOn, { short: true })}</TableCell>
                  <TableCell>
                    <span className="font-medium">{e.description}</span>
                    {e.vendor && <div className="text-xs text-muted-foreground">{e.vendor}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{expenseCategoryLabels[e.category]}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.project ? (
                      <Link href={`/projects/${e.project.id}`} className="link">{e.project.name}</Link>
                    ) : e.client ? (
                      <Link href={`/clients/${e.client.id}`} className="link">{e.client.name}</Link>
                    ) : (
                      "Studio"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatAmount(e.amount, e.currency)}</TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <ExpenseDialog expense={e} options={options} />
                        <DeleteExpenseButton expenseId={e.id} label={`${e.description} · ${formatAmount(e.amount, e.currency)}`} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </section>
  )
}
