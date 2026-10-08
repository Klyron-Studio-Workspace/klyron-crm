"use client"

import * as React from "react"
import { ArrowDownIcon, ArrowUpIcon, BadgePercentIcon, LandmarkIcon, PackageIcon, PlusIcon, Trash2Icon } from "lucide-react"

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
      <legend className="sr-only">Line items</legend>
      <input type="hidden" name="items" value={payload} />

      {/* Column headers (desktop). On phones each field is labelled inside its card. */}
      <div aria-hidden className="hidden gap-2 border-b border-border pb-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_5.5rem_8rem_7rem_6.5rem]">
        <span>Description</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Unit price ({currency})</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      <ol className="flex flex-col gap-3">
        {lines.map((line, index) => {
          const amount = fromCents(lineAmountCents({ quantity: parse(line.quantity), unitPrice: parse(line.unitPrice) }))
          const n = index + 1
          return (
            <li key={line.key} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_8rem_7rem_6.5rem] sm:items-start sm:border-0 sm:p-0">
              <span className="text-xs font-medium text-muted-foreground sm:hidden">Item {n}</span>
              <Textarea
                aria-label={`Line ${n} description`}
                placeholder={index === 0 ? "What you're charging for, e.g. Website design (5 pages)" : "Description"}
                rows={1}
                maxLength={500}
                value={line.description}
                onChange={(e) => update(line.key, { description: e.target.value })}
                className="min-h-10"
              />
              <Input
                aria-label={`Line ${n} quantity`}
                title="Quantity: hours, pages, months, or 1 for a fixed price"
                inputMode="decimal"
                value={line.quantity}
                onChange={(e) => update(line.key, { quantity: e.target.value })}
                className="h-10 text-right tabular-nums"
              />
              <Input
                aria-label={`Line ${n} unit price`}
                title="Price for one unit, before discount and tax"
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
            <SelectTrigger size="sm" aria-label="Add a service from the catalog" className="w-60">
              <PackageIcon aria-hidden className="size-3.5 text-muted-foreground" />
              <SelectValue placeholder="Add from your services…" />
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

      <p className="text-xs text-muted-foreground">
        Tip: pick from your services to fill the description and price automatically (set prices in Settings → Services).
      </p>

      <div className="mt-2 ml-auto grid w-full max-w-md grid-cols-[1fr_8rem] items-center gap-x-4 gap-y-3 rounded-xl bg-surface p-4 text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="text-right tabular-nums">{formatAmount(totals.subtotal, currency)}</span>
        <div>
          <Label htmlFor="doc-discount" className="gap-1.5 font-normal text-muted-foreground">
            <BadgePercentIcon aria-hidden className="size-3.5" /> Discount ({currency})
          </Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">A fixed amount off, taken before tax.</p>
        </div>
        <Input id="doc-discount" name="discount" inputMode="decimal" placeholder="0.00" value={discount} onChange={(e) => onDiscountChange(e.target.value)} className="h-9 bg-background text-right tabular-nums" />
        <div>
          <Label htmlFor="doc-tax" className="gap-1.5 font-normal text-muted-foreground">
            <LandmarkIcon aria-hidden className="size-3.5" /> Tax rate (%)
          </Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">e.g. 16 for 16% sales tax. Leave empty for none.</p>
        </div>
        <Input id="doc-tax" name="taxRate" inputMode="decimal" placeholder="0" value={taxRate} onChange={(e) => onTaxRateChange(e.target.value)} className="h-9 bg-background text-right tabular-nums" />
        {totals.tax > 0 && (
          <>
            <span className="text-muted-foreground">Tax</span>
            <span className="text-right tabular-nums">{formatAmount(totals.tax, currency)}</span>
          </>
        )}
        <span className="border-t border-border pt-3 font-semibold">Total</span>
        <span className="border-t border-border pt-3 text-right text-base font-semibold tabular-nums">{formatAmount(totals.total, currency)}</span>
      </div>
    </fieldset>
  )
}

export { LineItemsEditor }
