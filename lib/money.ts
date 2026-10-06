const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: string, compact: boolean) {
  const key = `${currency}:${compact}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: compact ? 1 : 0,
      notation: compact ? "compact" : "standard",
    })
    formatters.set(key, f)
  }
  return f
}

export function formatMoney(value: number, currency: string, options: { compact?: boolean } = {}) {
  return formatter(currency, options.compact ?? false).format(value)
}

/** "$12,000 · PKR 300,000". Totals are kept per currency; we never convert. */
export function formatTotals(totals: Record<string, number>, options: { compact?: boolean } = {}) {
  const entries = Object.entries(totals).filter(([, v]) => v > 0)
  if (entries.length === 0) return formatMoney(0, "USD", options)
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([currency, value]) => formatMoney(value, currency, options))
    .join(" · ")
}
