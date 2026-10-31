import type { Metadata } from "next"
import Link from "next/link"

import { formatAmount } from "@/components/finance/document-view"
import { RevenueChart } from "@/components/finance/revenue-chart"
import { StatCard } from "@/components/crm/stat-card"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requirePermission } from "@/lib/auth/dal"
import { getFinanceOverview, getOrgBilling } from "@/lib/finance/queries"
import { formatDateOnly } from "@/lib/format"
import { formatMoney, formatTotals } from "@/lib/money"

export const metadata: Metadata = { title: "Finance" }

/** Signed totals per currency (net can be negative, unlike formatTotals). */
function formatSigned(totals: Record<string, number>, fallback: string) {
  const entries = Object.entries(totals).filter(([, v]) => v !== 0)
  if (entries.length === 0) return formatMoney(0, fallback)
  return entries.map(([currency, value]) => formatMoney(value, currency, { compact: true })).join(" · ")
}

export default async function FinanceOverviewPage() {
  await requirePermission("finance", "READ")
  const org = await getOrgBilling()
  const currency = org.defaultCurrency
  const o = await getFinanceOverview(currency)
  const overdueCount = o.overdueInvoices.length

  return (
    <>
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Collected this month" value={formatTotals(o.collectedThisMonth, { compact: true })} hint={`Net ${formatSigned(o.net, currency)} after expenses`} />
        <StatCard label="Outstanding" value={formatTotals(o.outstanding, { compact: true })} hint={`${o.openCount} open ${o.openCount === 1 ? "invoice" : "invoices"}`} />
        <StatCard
          label="Overdue"
          value={formatTotals(o.overdue, { compact: true })}
          hint={overdueCount ? `${overdueCount} ${overdueCount === 1 ? "invoice needs" : "invoices need"} chasing` : "Nothing overdue"}
          className={overdueCount ? "border-primary/30" : undefined}
        />
        <StatCard label="Proposals out" value={formatTotals(o.pipeline, { compact: true })} hint={`${o.pipelineCount} awaiting an answer`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base font-semibold">Revenue vs. expenses</CardTitle>
            <CardDescription>
              Payments received and money spent over the last 12 months. Other currencies are counted in the figures above, not here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart series={o.series} currency={currency} />
            <p className="mt-4 text-sm text-muted-foreground">
              Expenses this month: <span className="font-medium text-foreground">{formatTotals(o.expensesThisMonth)}</span>.{" "}
              <Link href="/finance/expenses" className="link">
                Log an expense
              </Link>
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-5">
              <CardTitle className="text-base font-semibold">Overdue</CardTitle>
              <CardAction>
                <Link href="/finance/invoices?status=OVERDUE" className="link text-sm">
                  View all
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              {overdueCount === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">No overdue invoices.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {o.overdueInvoices.slice(0, 6).map((inv) => (
                    <li key={inv.id} className="relative flex items-center justify-between gap-3 px-6 py-3 text-sm hover:bg-muted/50">
                      <div className="min-w-0">
                        <Link href={`/finance/invoices/${inv.id}`} className="font-medium after:absolute after:inset-0">
                          {inv.number}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {inv.client.name} · due {formatDateOnly(inv.dueDate, { short: true })}
                        </p>
                      </div>
                      <span className="font-medium text-primary-strong tabular-nums">{formatAmount(inv.balance, inv.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-5">
              <CardTitle className="text-base font-semibold">Top clients this year</CardTitle>
              <CardDescription>By payments received.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {o.topClients.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">No payments yet this year.</p>
              ) : (
                <ol className="divide-y divide-border">
                  {o.topClients.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                      <Link href={`/clients/${c.id}`} className="link truncate">
                        {c.name}
                      </Link>
                      <span className="tabular-nums">{formatTotals(c.totals, { compact: true })}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
