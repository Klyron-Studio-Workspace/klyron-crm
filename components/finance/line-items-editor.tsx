"use client"

import * as React from "react"
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { formatAmount } from "@/components/finance/document-view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { computeTotals, fromCents, lineAmountCents } from "@/lib/finance/math"
import type { CatalogServiceDTO } from "@/lib/finance/types"

export type EditableLine = { key: string; serviceId: string | null; description: string; quantity: string; unitPrice: string }

let lineCounter = 0
export const newLine = (partial: Partial<Omit<EditableLine, "key">> = {}): EditableLine => ({
  key: `line-${++lineCounter}`,
  serviceId: null,
  description: "",
  quantity: "1",
  unitPrice: "",
  ...partial,
})

const parse = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

type LineItemsEditorProps = {
  lines: EditableLine[]
  onLinesChange: (lines: EditableLine[]) => void
  discount: string
  onDiscountChange: (v: string) => void
  taxRate: string
  onTaxRateChange: (v: string) => void
  currency: string
  catalog: CatalogServiceDTO[]
  error?: string
}

/** Line items with live totals. Submits `items` (JSON), `discount` and `taxRate`. */
function LineItemsEditor({ lines, onLinesChange, discount, onDiscountChange, taxRate, onTaxRateChange, currency, catalog, error }: LineItemsEditorProps) {
  const totals = computeTotals(
    lines.map((l) => ({ quantity: parse(l.quantity), unitPrice: parse(l.unitPrice) })),
    parse(discount),
    parse(taxRate)
  )
  const payload = JSON.stringify(
    lines
      .filter((l) => l.description.trim() || l.unitPrice)
      .map((l) => ({ serviceId: l.serviceId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice || "0" }))
  )

  const update = (key: string, patch: Partial<EditableLine>) => onLinesChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const move = (index: number, delta: number) => {
    const next = [...lines]
    const [line] = next.splice(index, 1)
    next.splice(index + delta, 0, line)
    onLinesChange(next)
  }
  function addService(serviceId: string) {
    const service = catalog.find((s) => s.id === serviceId)
    if (!service) return
    const line = newLine({
      serviceId: service.id,
      description: service.description ? `${service.name}: ${service.description}` : service.name,
      unitPrice: service.price != null ? String(service.price) : "",
    })
    const blank = lines.length === 1 && !lines[0].description && !lines[0].unitPrice
    onLinesChange(blank ? [line] : [...lines, line])
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-sm font-medium">Line items</legend>
      <input type="hidden" name="items" value={payload} />

      <ol className="flex flex-col gap-3">
        {lines.map((line, index) => {
          const amount = fromCents(lineAmountCents({ quantity: parse(line.quantity), unitPrice: parse(line.unitPrice) }))
          const n = index + 1
          return (
            <li key={line.key} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_8rem_7rem_auto] sm:items-start sm:border-0 sm:p-0">
              <Textarea
                aria-label={`Line ${n} description`}
                placeholder="Description"
                rows={1}
                maxLength={500}
                value={line.description}
                onChange={(e) => update(line.key, { description: e.target.value })}
                className="min-h-10"
              />
              <Input
                aria-label={`Line ${n} quantity`}
                inputMode="decimal"
                value={line.quantity}
                onChange={(e) => update(line.key, { quantity: e.target.value })}
                className="h-10 text-right tabular-nums"
              />
              <Input
                aria-label={`Line ${n} unit price`}
                inputMode="decimal"
                placeholder="0.00"
                value={line.unitPrice}
                onChange={(e) => update(line.key, { unitPrice: e.target.value })}
                className="h-10 text-right tabular-nums"
              />
              <p className="flex h-10 items-center justify-end text-sm tabular-nums" aria-label={`Line ${n} amount`}>
                {formatAmount(amount, currency)}
              </p>
              <div className="flex h-10 items-center justify-end gap-0.5">
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move line ${n} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                  <ArrowUpIcon />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move line ${n} down`} disabled={index === lines.length - 1} onClick={() => move(index, 1)}>
                  <ArrowDownIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove line ${n}`}
                  disabled={lines.length === 1}
                  className="text-muted-foreground hover:text-primary-strong"
                  onClick={() => onLinesChange(lines.filter((l) => l.key !== line.key))}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          )
        })}
      </ol>
      {error && <p className="text-xs text-primary-strong">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => onLinesChange([...lines, newLine()])}>
          <PlusIcon data-icon="inline-start" />
          Add line
        </Button>
        {catalog.length > 0 && (
          <Select
            items={catalog.map((s) => ({ value: s.id, label: s.name }))}
            value={null}
            onValueChange={(v: string | null) => v && addService(v)}
          >
            <SelectTrigger size="sm" aria-label="Add a service from the catalog" className="w-56">
              <SelectValue placeholder="Add from services…" />
            </SelectTrigger>
            <SelectContent>
              {catalog.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  {s.price != null && <span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">{formatAmount(s.price, currency)} {s.unitLabel}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="mt-2 ml-auto grid w-full max-w-sm grid-cols-[1fr_8rem] items-center gap-x-4 gap-y-2 text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="text-right tabular-nums">{formatAmount(totals.subtotal, currency)}</span>
        <Label htmlFor="doc-discount" className="font-normal text-muted-foreground">Discount ({currency})</Label>
        <Input id="doc-discount" name="discount" inputMode="decimal" placeholder="0.00" value={discount} onChange={(e) => onDiscountChange(e.target.value)} className="h-9 text-right tabular-nums" />
        <Label htmlFor="doc-tax" className="font-normal text-muted-foreground">Tax rate (%)</Label>
        <Input id="doc-tax" name="taxRate" inputMode="decimal" placeholder="0" value={taxRate} onChange={(e) => onTaxRateChange(e.target.value)} className="h-9 text-right tabular-nums" />
        {totals.tax > 0 && (
          <>
            <span className="text-muted-foreground">Tax</span>
            <span className="text-right tabular-nums">{formatAmount(totals.tax, currency)}</span>
          </>
        )}
        <span className="border-t border-border pt-2 font-semibold">Total</span>
        <span className="border-t border-border pt-2 text-right font-semibold tabular-nums">{formatAmount(totals.total, currency)}</span>
      </div>
    </fieldset>
  )
}

export { LineItemsEditor }
