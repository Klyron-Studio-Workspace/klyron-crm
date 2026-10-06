"use client"

import * as React from "react"
import { useActionState } from "react"
import Link from "next/link"

import { ChoiceField } from "@/components/forms/choice-field"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { LineItemsEditor, newLine, type EditableLine } from "@/components/finance/line-items-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { saveInvoice, saveProposal } from "@/lib/actions/finance"
import { currencyItems } from "@/lib/finance/constants"
import type { CatalogServiceDTO, LineItemDTO } from "@/lib/finance/types"

export const toEditableLines = (items: LineItemDTO[]) =>
  items.length ? items.map((i) => newLine({ serviceId: i.serviceId, description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice) })) : [newLine()]

function TextAreaField({ label, name, value, onChange, rows = 3, hint, error }: { label: string; name: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string; error?: string }) {
  const id = `doc-${name}`
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} name={name} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} />
      {error ? <p className="text-xs text-primary-strong">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** Shared state for line items, discount, tax and currency. */
function useDocumentState(initial: { items: LineItemDTO[]; discount: number; taxRate: number; currency: string }) {
  const [lines, setLines] = React.useState<EditableLine[]>(() => toEditableLines(initial.items))
  const [discount, setDiscount] = React.useState(initial.discount ? String(initial.discount) : "")
  const [taxRate, setTaxRate] = React.useState(initial.taxRate ? String(initial.taxRate) : "")
  const [currency, setCurrency] = React.useState(initial.currency)
  return { lines, setLines, discount, setDiscount, taxRate, setTaxRate, currency, setCurrency }
}

// ─── Invoice ────────────────────────────────────────────────────────────────

export type InvoiceFormInitial = {
  clientId: string
  projectId: string
  proposalId: string
  currency: string
  issueDate: string
  dueDate: string
  notes: string
  discount: number
  taxRate: number
  items: LineItemDTO[]
}

type InvoiceFormProps = {
  invoiceId?: string
  initial: InvoiceFormInitial
  clients: { id: string; name: string }[]
  projects: { id: string; name: string; clientId: string }[]
  catalog: CatalogServiceDTO[]
  cancelHref: string
  /** Locked once payments exist. */
  currencyLocked?: boolean
}

function InvoiceForm({ invoiceId, initial, clients, projects, catalog, cancelHref, currencyLocked }: InvoiceFormProps) {
  const [state, action, pending] = useActionState(saveInvoice, undefined)
  const errors = state?.fieldErrors
  const doc = useDocumentState(initial)
  const [clientId, setClientId] = React.useState(initial.clientId)
  const [projectId, setProjectId] = React.useState(initial.projectId || "none")
  const [issueDate, setIssueDate] = React.useState(initial.issueDate)
  const [dueDate, setDueDate] = React.useState(initial.dueDate)
  const [notes, setNotes] = React.useState(initial.notes)
  const clientProjects = projects.filter((p) => p.clientId === clientId)

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {invoiceId && <input type="hidden" name="invoiceId" value={invoiceId} />}
      {initial.proposalId && <input type="hidden" name="proposalId" value={initial.proposalId} />}
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ChoiceField
              label="Client"
              name="clientId"
              id="invoice-client"
              value={clientId}
              onChange={(v) => {
                setClientId(v)
                setProjectId("none")
              }}
              items={clients.map((c) => ({ value: c.id, label: c.name }))}
              error={errors?.clientId?.[0]}
            />
            <ChoiceField
              label="Project (optional)"
              name="projectId"
              id="invoice-project"
              value={projectId}
              onChange={setProjectId}
              items={[{ value: "none", label: "No project" }, ...clientProjects.map((p) => ({ value: p.id, label: p.name }))]}
              error={errors?.projectId?.[0]}
            />
            <ChoiceField
              label="Currency"
              name="currency"
              id="invoice-currency"
              value={doc.currency}
              onChange={doc.setCurrency}
              items={currencyItems}
              disabled={currencyLocked}
              hint={currencyLocked ? "Fixed once a payment is recorded." : undefined}
              error={errors?.currency?.[0]}
            />
            {currencyLocked && <input type="hidden" name="currency" value={doc.currency} />}
            <FormField label="Issue date" name="issueDate" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} errors={errors?.issueDate} />
            <FormField label="Due date" name="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} errors={errors?.dueDate} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <LineItemsEditor
            lines={doc.lines}
            onLinesChange={doc.setLines}
            discount={doc.discount}
            onDiscountChange={doc.setDiscount}
            taxRate={doc.taxRate}
            onTaxRateChange={doc.setTaxRate}
            currency={doc.currency}
            catalog={catalog}
            error={errors?.items?.[0] ?? errors?.discount?.[0] ?? errors?.taxRate?.[0]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <TextAreaField label="Notes for the client (optional)" name="notes" value={notes} onChange={setNotes} hint="e.g. a thank-you, the scope covered, or a PO number." />
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" nativeButton={false} render={<Link href={cancelHref} />}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : invoiceId ? "Save changes" : "Create draft"}
        </Button>
      </div>
    </form>
  )
}

// ─── Proposal ───────────────────────────────────────────────────────────────

export type ProposalFormInitial = {
  recipient: string
  title: string
  currency: string
  issueDate: string
  validUntil: string
  introduction: string
  terms: string
  discount: number
  taxRate: number
  items: LineItemDTO[]
}

type ProposalFormProps = {
  proposalId?: string
  initial: ProposalFormInitial
  recipients: { value: string; label: string }[]
  catalog: CatalogServiceDTO[]
  cancelHref: string
}

function ProposalForm({ proposalId, initial, recipients, catalog, cancelHref }: ProposalFormProps) {
  const [state, action, pending] = useActionState(saveProposal, undefined)
  const errors = state?.fieldErrors
  const doc = useDocumentState(initial)
  const [recipient, setRecipient] = React.useState(initial.recipient)
  const [title, setTitle] = React.useState(initial.title)
  const [issueDate, setIssueDate] = React.useState(initial.issueDate)
  const [validUntil, setValidUntil] = React.useState(initial.validUntil)
  const [introduction, setIntroduction] = React.useState(initial.introduction)
  const [terms, setTerms] = React.useState(initial.terms)

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {proposalId && <input type="hidden" name="proposalId" value={proposalId} />}
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}

      <Card>
        <CardContent className="flex flex-col gap-5">
          <FormField label="Title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Website redesign" maxLength={160} errors={errors?.title} />
          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceField
              label="For"
              name="recipient"
              id="proposal-recipient"
              value={recipient}
              onChange={setRecipient}
              items={recipients}
              error={errors?.recipient?.[0]}
            />
            <ChoiceField label="Currency" name="currency" id="proposal-currency" value={doc.currency} onChange={doc.setCurrency} items={currencyItems} error={errors?.currency?.[0]} />
            <FormField label="Issue date" name="issueDate" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} errors={errors?.issueDate} />
            <FormField label="Valid until (optional)" name="validUntil" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} errors={errors?.validUntil} />
          </div>
          <TextAreaField label="Introduction (optional)" name="introduction" rows={4} value={introduction} onChange={setIntroduction} hint="The pitch: goals, approach and what's included." />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <LineItemsEditor
            lines={doc.lines}
            onLinesChange={doc.setLines}
            discount={doc.discount}
            onDiscountChange={doc.setDiscount}
            taxRate={doc.taxRate}
            onTaxRateChange={doc.setTaxRate}
            currency={doc.currency}
            catalog={catalog}
            error={errors?.items?.[0] ?? errors?.discount?.[0] ?? errors?.taxRate?.[0]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <TextAreaField label="Terms (optional)" name="terms" rows={4} value={terms} onChange={setTerms} hint="Payment schedule, revisions, timelines." />
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" nativeButton={false} render={<Link href={cancelHref} />}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : proposalId ? "Save changes" : "Create draft"}
        </Button>
      </div>
    </form>
  )
}

export { InvoiceForm, ProposalForm }
