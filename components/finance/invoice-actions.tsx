"use client"

import { CalendarIcon, CoinsIcon, HashIcon, WalletIcon } from "lucide-react"
import * as React from "react"
import { useActionState } from "react"
import Link from "next/link"
import {
  BanknoteIcon,
  BellRingIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react"

import { ChoiceField } from "@/components/forms/choice-field"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/toast"
import {
  deleteInvoice,
  deletePayment,
  recordPayment,
  sendInvoice,
  sendPaymentReminder,
  voidInvoice,
} from "@/lib/actions/finance"
import { paymentMethodLabels } from "@/lib/finance/constants"

type ActionResult = { ok: boolean; message?: string; error?: string } | undefined

/** Runs a server action and reports the outcome as a toast. */
export function useRunAction() {
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()
  const run = (task: () => Promise<ActionResult | void>, errorTitle: string) =>
    startTransition(async () => {
      const result = await task()
      if (!result) return
      if (result.ok) {
        if (result.message) toast.add({ type: "success", title: result.message })
      } else toast.add({ type: "error", title: errorTitle, description: result.error })
    })
  return { run, pending }
}

/** Copies a public document link. */
export function CopyLinkButton({ path, label = "Copy link" }: { path: string; label?: string }) {
  const toast = useToast()
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(new URL(path, window.location.origin).toString())
          toast.add({ type: "success", title: "Link copied", description: "Anyone with this link can view the document." })
        } catch {
          toast.add({ type: "error", title: "Couldn't copy the link" })
        }
      }}
    >
      <CopyIcon data-icon="inline-start" />
      {label}
    </Button>
  )
}

type InvoiceActionsProps = {
  invoiceId: string
  number: string
  status: "DRAFT" | "SENT" | "PAID" | "VOID"
  overdue: boolean
  publicPath: string
  balance: number
  currency: string
  today: string
}

function InvoiceActions({ invoiceId, number, status, overdue, publicPath, balance, currency, today }: InvoiceActionsProps) {
  const { run, pending } = useRunAction()
  const [confirm, setConfirm] = React.useState<"void" | "delete" | null>(null)
  const [paying, setPaying] = React.useState(false)
  const [payKey, setPayKey] = React.useState(0)
  const editable = status === "DRAFT" || status === "SENT"

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && (
        <Button disabled={pending} onClick={() => run(() => sendInvoice(invoiceId, { email: true }), "Couldn't send invoice")}>
          <SendIcon data-icon="inline-start" />
          Send to client
        </Button>
      )}
      {status === "SENT" && (
        <Button
          onClick={() => {
            setPayKey((k) => k + 1)
            setPaying(true)
          }}
        >
          <BanknoteIcon data-icon="inline-start" />
          Record payment
        </Button>
      )}
      {status === "SENT" && overdue && (
        <Button variant="secondary" disabled={pending} onClick={() => run(() => sendPaymentReminder(invoiceId), "Couldn't send reminder")}>
          <BellRingIcon data-icon="inline-start" />
          Send reminder
        </Button>
      )}
      <Button variant="secondary" nativeButton={false} render={<a href={publicPath} target="_blank" rel="noopener noreferrer" />}>
        <ExternalLinkIcon data-icon="inline-start" />
        View / PDF
      </Button>
      <CopyLinkButton path={publicPath} />
      {editable && (
        <Button variant="secondary" nativeButton={false} render={<Link href={`/finance/invoices/${invoiceId}/edit`} />}>
          <PencilIcon data-icon="inline-start" />
          Edit
        </Button>
      )}
      {status !== "VOID" && status !== "PAID" && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="More invoice actions" />}>
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {status === "DRAFT" && (
              <DropdownMenuItem onClick={() => run(() => sendInvoice(invoiceId, { email: false }), "Couldn't update invoice")}>
                <CheckIcon /> Mark as sent (no email)
              </DropdownMenuItem>
            )}
            {status === "SENT" && (
              <DropdownMenuItem onClick={() => run(() => sendInvoice(invoiceId, { email: true }), "Couldn't send invoice")}>
                <SendIcon /> Email again
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {status === "DRAFT" ? (
              <DropdownMenuItem variant="destructive" onClick={() => setConfirm("delete")}>
                <Trash2Icon /> Delete draft
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant="destructive" onClick={() => setConfirm("void")}>
                <XCircleIcon /> Void invoice
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === "delete" ? `Delete draft ${number}?` : `Void ${number}?`}</DialogTitle>
            <DialogDescription>
              {confirm === "delete"
                ? "The draft is removed. Its number won't be reused."
                : "The invoice stays on record but no longer counts as owed, and the client's link shows it as void. This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const action = confirm
                setConfirm(null)
                run(() => (action === "delete" ? deleteInvoice(invoiceId) : voidInvoice(invoiceId)), "Couldn't update invoice")
              }}
            >
              {confirm === "delete" ? "Delete draft" : "Void invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paying} onOpenChange={setPaying}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              {number} · {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(balance)} outstanding
            </DialogDescription>
          </DialogHeader>
          <PaymentForm key={payKey} invoiceId={invoiceId} balance={balance} today={today} onDone={() => setPaying(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

const methodItems = Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }))

function PaymentForm({ invoiceId, balance, today, onDone }: { invoiceId: string; balance: number; today: string; onDone: () => void }) {
  const toast = useToast()
  const [state, action, pending] = useActionState(recordPayment, undefined)
  const [amount, setAmount] = React.useState(balance.toFixed(2))
  const [paidOn, setPaidOn] = React.useState(today)
  const [method, setMethod] = React.useState("BANK_TRANSFER")
  const [reference, setReference] = React.useState("")
  const errors = state?.fieldErrors

  // Handle each successful result once (onDone and toast change identity on re-render).
  const handled = React.useRef<typeof state>(undefined)
  React.useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state
      toast.add({ type: "success", title: state.message ?? "Payment recorded." })
      onDone()
    }
  }, [state, toast, onDone])

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount" icon={CoinsIcon} hint="How much you received. Partial payments are fine." name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} errors={errors?.amount} />
        <FormField label="Received on" icon={CalendarIcon} name="paidOn" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} errors={errors?.paidOn} />
        <ChoiceField label="Method" icon={WalletIcon} name="method" id="payment-method" value={method} onChange={setMethod} items={methodItems} />
        <FormField label="Reference" icon={HashIcon} optional hint="Transaction or cheque number, for your records." name="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction ID" maxLength={120} />
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="secondary" />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Record payment"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function DeletePaymentButton({ paymentId, label }: { paymentId: string; label: string }) {
  const { run, pending } = useRunAction()
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`Remove payment ${label}`} disabled={pending} className="text-muted-foreground hover:text-primary-strong" onClick={() => setOpen(true)}>
        <Trash2Icon />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove the payment of {label}?</DialogTitle>
            <DialogDescription>The invoice balance goes back up. Use this to correct a mistake.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setOpen(false)
                run(() => deletePayment(paymentId), "Couldn't remove payment")
              }}
            >
              Remove payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { DeletePaymentButton, InvoiceActions }
