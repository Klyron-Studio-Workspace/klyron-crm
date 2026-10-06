import { formatMoney } from "@/lib/money"
import type { MonthPoint } from "@/lib/finance/queries"

const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" })
const monthLong = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })

/** Collected revenue vs. expenses per month, one currency. Plain SVG, no chart library. */
function RevenueChart({ series, currency }: { series: MonthPoint[]; currency: string }) {
  const max = Math.max(1, ...series.flatMap((p) => [p.revenue, p.expenses]))
  const height = 180
  const barArea = height - 24
  const slot = 100 / series.length

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-xs bg-primary" /> Collected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-xs bg-foreground/20" /> Expenses
        </span>
        <span className="ml-auto">{currency}</span>
      </div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-48 w-full overflow-visible" role="img" aria-label={`Collected revenue and expenses for the last ${series.length} months, in ${currency}`}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1="0" x2="100" y1={barArea - barArea * f} y2={barArea - barArea * f} className="stroke-border" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        {series.map((p, i) => {
          const x = i * slot
          const w = slot * 0.32
          const rev = (p.revenue / max) * barArea
          const exp = (p.expenses / max) * barArea
          const date = new Date(`${p.month}-01T00:00:00Z`)
          return (
            <g key={p.month}>
              <title>{`${monthLong.format(date)}: ${formatMoney(p.revenue, currency)} collected, ${formatMoney(p.expenses, currency)} expenses`}</title>
              <rect x={x + slot * 0.16} y={barArea - rev} width={w} height={Math.max(rev, 0)} rx="0.6" className="fill-primary" />
              <rect x={x + slot * 0.16 + w + slot * 0.04} y={barArea - exp} width={w} height={Math.max(exp, 0)} rx="0.6" className="fill-foreground/20" />
            </g>
          )
        })}
      </svg>
      <div className="grid text-center text-[11px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}>
        {series.map((p) => (
          <span key={p.month}>{monthLabel.format(new Date(`${p.month}-01T00:00:00Z`))}</span>
        ))}
      </div>
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Collected</th>
              <th>Expenses</th>
            </tr>
          </thead>
          <tbody>
            {series.map((p) => (
              <tr key={p.month}>
                <td>{monthLong.format(new Date(`${p.month}-01T00:00:00Z`))}</td>
                <td>{formatMoney(p.revenue, currency)}</td>
                <td>{formatMoney(p.expenses, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  )
}

export { RevenueChart }
