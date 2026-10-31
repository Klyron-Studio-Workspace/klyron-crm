import { KlyronMark } from "@/components/brand/klyron-mark"
import { PaperScale } from "@/components/finance/paper-scale"
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
    <section className="flex flex-col gap-2 break-inside-avoid">
      <h3 className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</h3>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">{children}</div>
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
  const kindLabel = kind === "invoice" ? "Invoice" : "Proposal"

  return (
    <PaperScale>
    <article
      data-slot="document"
      className={cn(
        "flex flex-col gap-0 rounded-xl border border-border bg-card shadow-sm print:rounded-none print:border-0 print:shadow-none",
        className,
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-6 px-10 pt-10 pb-6">
        {/* Studio identity */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <KlyronMark className="size-8" decorative />
            <span className="font-heading text-base font-semibold tracking-tight">{studio.name}</span>
          </div>
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {studio.address && <p className="whitespace-pre-wrap">{studio.address}</p>}
            {(studio.billingEmail || studio.website) && (
              <p>{[studio.billingEmail, studio.website?.replace(/^https?:\/\//, "")].filter(Boolean).join("  ·  ")}</p>
            )}
          </div>
        </div>

        {/* Document type — large serif */}
        <div className="flex flex-col items-end gap-1.5">
          <h2 className="font-serif text-6xl font-normal tracking-tight text-foreground">{kindLabel}</h2>
          {stamp && <div className="mt-1">{stamp}</div>}
        </div>
      </div>

      {/* ── Crimson rule ── */}
      <div className="mx-10 h-[2px] bg-primary" />

      {/* ── Bill-to + meta ── */}
      <div className="flex items-start justify-between gap-6 px-10 py-6">
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {kind === "invoice" ? "Billed to" : "Prepared for"}
          </p>
          <p className="font-semibold text-foreground">{billTo.name}</p>
          {billTo.contactName && <p className="text-sm text-muted-foreground">{billTo.contactName}</p>}
          {billTo.email && <p className="text-sm text-muted-foreground">{billTo.email}</p>}
        </div>

        <dl className="flex flex-col items-end gap-1.5 text-right">
          <div className="flex flex-row-reverse items-baseline gap-4">
            <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {kindLabel} No.
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums">{title ?? number}</span>
          </div>
          {title && (
            <div className="flex flex-row-reverse items-baseline gap-4">
              <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Ref</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{number}</span>
            </div>
          )}
          {dates
            .filter((d) => d.value)
            .map((d) => (
              <div key={d.label} className="flex flex-row-reverse items-baseline gap-4">
                <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {d.label}
                </span>
                <span className="text-sm tabular-nums">{formatDateOnly(d.value!)}</span>
              </div>
            ))}
        </dl>
      </div>

      {introduction && (
        <p className="px-10 pb-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{introduction}</p>
      )}

      {/* ── Line items ── */}
      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-border bg-muted/40">
              <th scope="col" className="py-3 pl-10 pr-4 text-left text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Description
              </th>
              <th scope="col" className="w-16 py-3 pr-4 text-right text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Qty
              </th>
              <th scope="col" className="w-32 py-3 pr-4 text-right text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Unit Price
              </th>
              <th scope="col" className="w-32 py-3 pr-10 text-right text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={i}
                className={cn(
                  "align-top break-inside-avoid border-b border-border/60 last:border-0",
                  i % 2 === 1 && "bg-muted/20",
                )}
              >
                <td className="py-3.5 pl-10 pr-4 whitespace-pre-wrap">{item.description}</td>
                <td className="py-3.5 pr-4 text-right tabular-nums text-muted-foreground">{qty(item.quantity)}</td>
                <td className="py-3.5 pr-4 text-right tabular-nums text-muted-foreground">{formatAmount(item.unitPrice, currency)}</td>
                <td className="py-3.5 pr-10 text-right font-medium tabular-nums">{formatAmount(item.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Totals ── */}
      <div className="flex justify-end px-10 py-6">
        <dl className="w-full max-w-xs">
          <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatAmount(totals.subtotal, currency)}</dd>
          </div>
          {totals.discount > 0 && (
            <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="tabular-nums">−{formatAmount(totals.discount, currency)}</dd>
            </div>
          )}
          {totals.taxRate > 0 && (
            <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
              <dt className="text-muted-foreground">Tax ({totals.taxRate}%)</dt>
              <dd className="tabular-nums">{formatAmount(totals.tax, currency)}</dd>
            </div>
          )}
          {/* Total — dark band */}
          <div className="mt-2 flex items-center justify-between gap-4 rounded-lg bg-foreground px-4 py-3 break-inside-avoid">
            <dt className="text-sm font-semibold text-background">Total</dt>
            <dd className="font-heading text-xl font-bold tabular-nums text-background">{formatAmount(totals.total, currency)}</dd>
          </div>

          {amountPaid != null && amountPaid > 0 && (
            <>
              <div className="flex items-center justify-between gap-4 py-1.5 text-sm mt-2">
                <dt className="text-muted-foreground">Paid</dt>
                <dd className="tabular-nums">−{formatAmount(amountPaid, currency)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg bg-primary/10 px-4 py-3 break-inside-avoid mt-1">
                <dt className="text-sm font-semibold text-primary-strong">Balance due</dt>
                <dd className="font-heading text-xl font-bold tabular-nums text-primary-strong">{formatAmount(balance ?? 0, currency)}</dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {/* ── Thank you + signature ── */}
      <div className="flex items-end justify-between gap-4 px-10 pb-6">
        <p className="font-serif text-4xl italic text-foreground/80">Thank you!</p>
        {studio.signatureSvg && (
          <div
            className="w-56 shrink-0 text-foreground [&_svg]:h-auto [&_svg]:w-full print:w-44"
            dangerouslySetInnerHTML={{ __html: studio.signatureSvg }}
          />
        )}
      </div>

      {/* ── Footer: payment + notes ── */}
      {(notes || terms || (showPaymentInstructions && studio.paymentInstructions)) && (
        <div className="mx-10 border-t border-border" />
      )}

      {(notes || terms || (showPaymentInstructions && studio.paymentInstructions)) && (
        <div className="flex flex-wrap gap-6 px-10 pt-6 pb-10">
          {showPaymentInstructions && studio.paymentInstructions && (
            <Block label="Payment details">{studio.paymentInstructions}</Block>
          )}
          {notes && <Block label="Notes">{notes}</Block>}
          {terms && <Block label="Terms">{terms}</Block>}
        </div>
      )}

      {/* bottom padding when no footer blocks */}
      {!notes && !terms && !(showPaymentInstructions && studio.paymentInstructions) && (
        <div className="pb-10" />
      )}
    </article>
    </PaperScale>
  )
}

export { DocumentView }
