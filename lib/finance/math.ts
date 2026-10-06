/**
 * Money math in integer cents, so 0.1 + 0.2 never shows up on an invoice.
 * Used by the editor (live totals) and the server (stored totals); both must agree.
 */

export type LineInput = { quantity: number; unitPrice: number }

export const toCents = (value: number) => Math.round(value * 100)
export const fromCents = (cents: number) => cents / 100

export function lineAmountCents({ quantity, unitPrice }: LineInput) {
  return Math.round(quantity * toCents(unitPrice))
}

export function computeTotals(lines: LineInput[], discount: number, taxRate: number) {
  const subtotal = lines.reduce((sum, line) => sum + lineAmountCents(line), 0)
  const discountCents = Math.min(Math.max(toCents(discount), 0), subtotal)
  const taxable = subtotal - discountCents
  const tax = Math.round((taxable * Math.max(taxRate, 0)) / 100)
  return {
    subtotal: fromCents(subtotal),
    discount: fromCents(discountCents),
    tax: fromCents(tax),
    total: fromCents(taxable + tax),
  }
}

/** Adds amounts per currency: { USD: 1200, PKR: 50000 }. */
export function addTo(totals: Record<string, number>, currency: string, amount: number) {
  totals[currency] = fromCents(toCents(totals[currency] ?? 0) + toCents(amount))
  return totals
}
