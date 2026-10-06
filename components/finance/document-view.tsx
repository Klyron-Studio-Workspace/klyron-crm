import { KlyronMark } from "@/components/brand/klyron-mark"
import { formatDateOnly } from "@/lib/format"
import type { BillToDTO, LineItemDTO, StudioDTO, TotalsDTO } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

const currencyFormatters = new Map<string, Intl.NumberFormat>()
/** Documents always show cents, unlike dashboard figures. */
export function formatAmount(value: number, currency: string) {
  let f = currencyFormatters.get(currency)
  if (!f) {
    f = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    currencyFormatters.set(currency, f)
  }
  return f.format(value)
}

const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

type DocumentViewProps = {
  kind: "invoice" | "proposal"
  number: string
  title?: string
  studio: StudioDTO
  billTo: BillToDTO
  currency: string
  dates: { label: string; value: string | null }[]
  items: LineItemDTO[]
  totals: TotalsDTO
  /** Shown under the totals for invoices. */
  amountPaid?: number
  introduction?: string | null
  notes?: string | null
  terms?: string | null
  showPaymentInstructions?: boolean
  /** e.g. a status badge or a "PAID" stamp. */
  stamp?: React.ReactNode
  className?: string
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 break-inside-avoid">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</h3>
      <div className="text-sm whitespace-pre-wrap">{children}</div>
    </section>
  )
}

/** The printable "paper" for invoices and proposals, shared by the CRM, the portal and public links. */
function DocumentView({
  kind,
  number,
  title,
  studio,
  billTo,
  currency,
  dates,
  items,
  totals,
  amountPaid,
  introduction,
  notes,
  terms,
  showPaymentInstructions = kind === "invoice",
  stamp,
  className,
}: DocumentViewProps) {
  const balance = amountPaid != null ? Math.round((totals.total - amountPaid) * 100) / 100 : null
  return (
    <article
      data-slot="document"
      className={cn("flex flex-col gap-8 rounded-xl border border-border bg-card p-6 shadow-xs sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none", className)}
    >
      <header className="flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-primary-strong uppercase">{kind === "invoice" ? "Invoice" : "Proposal"}</p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">{title ?? number}</h2>
          {title && <p className="text-sm text-muted-foreground">{number}</p>}
          {stamp && <div className="mt-2">{stamp}</div>}
        </div>
        <div className="flex flex-col gap-1 sm:items-end sm:text-right">
          <div className="flex items-center gap-2">
            <KlyronMark className="size-7" decorative />
            <span className="font-heading text-base font-semibold">{studio.name}</span>
          </div>
          {studio.address && <p className="text-xs whitespace-pre-wrap text-muted-foreground">{studio.address}</p>}
          {(studio.billingEmail || studio.website) && (
            <p className="text-xs text-muted-foreground">{[studio.billingEmail, studio.website?.replace(/^https?:\/\//, "")].filter(Boolean).join(" · ")}</p>
          )}
        </div>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <Block label={kind === "invoice" ? "Bill to" : "Prepared for"}>
          <p className="font-medium">{billTo.name}</p>
          {billTo.contactName && <p className="text-muted-foreground">{billTo.contactName}</p>}
          {billTo.email && <p className="text-muted-foreground">{billTo.email}</p>}
        </Block>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 self-start text-sm sm:justify-self-end">
          {dates
            .filter((d) => d.value)
            .map((d) => (
              <div key={d.label} className="contents">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="text-right tabular-nums">{formatDateOnly(d.value!)}</dd>
              </div>
            ))}
        </dl>
      </div>

      {introduction && <div className="text-sm leading-relaxed whitespace-pre-wrap">{introduction}</div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">Description</th>
              <th scope="col" className="w-16 py-2 pr-4 text-right font-medium">Qty</th>
              <th scope="col" className="w-32 py-2 pr-4 text-right font-medium">Price</th>
              <th scope="col" className="w-32 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-border align-top break-inside-avoid">
                <td className="py-3 pr-4 whitespace-pre-wrap">{item.description}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{qty(item.quantity)}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{formatAmount(item.unitPrice, currency)}</td>
                <td className="py-3 text-right tabular-nums">{formatAmount(item.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm break-inside-avoid">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="text-right tabular-nums">{formatAmount(totals.subtotal, currency)}</dd>
        {totals.discount > 0 && (
          <>
            <dt className="text-muted-foreground">Discount</dt>
            <dd className="text-right tabular-nums">−{formatAmount(totals.discount, currency)}</dd>
          </>
        )}
        {totals.taxRate > 0 && (
          <>
            <dt className="text-muted-foreground">Tax ({totals.taxRate}%)</dt>
            <dd className="text-right tabular-nums">{formatAmount(totals.tax, currency)}</dd>
          </>
        )}
        <dt className="border-t border-border pt-2 font-semibold">Total</dt>
        <dd className="border-t border-border pt-2 text-right font-semibold tabular-nums">{formatAmount(totals.total, currency)}</dd>
        {amountPaid != null && amountPaid > 0 && (
          <>
            <dt className="text-muted-foreground">Paid</dt>
            <dd className="text-right tabular-nums">−{formatAmount(amountPaid, currency)}</dd>
            <dt className="font-semibold text-primary-strong">Balance due</dt>
            <dd className="text-right font-semibold text-primary-strong tabular-nums">{formatAmount(balance ?? 0, currency)}</dd>
          </>
        )}
      </dl>

      {(notes || terms || (showPaymentInstructions && studio.paymentInstructions)) && (
        <div className="grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
          {showPaymentInstructions && studio.paymentInstructions && <Block label="How to pay">{studio.paymentInstructions}</Block>}
          {notes && <Block label="Notes">{notes}</Block>}
          {terms && <Block label="Terms">{terms}</Block>}
        </div>
      )}
    </article>
  )
}

export { DocumentView }
