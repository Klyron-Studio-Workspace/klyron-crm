"use client"

import * as React from "react"
import { useActionState } from "react"
import Link from "next/link"
import {
  BuildingIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarIcon,
  CoinsIcon,
  FileSignatureIcon,
  FolderKanbanIcon,
  ListChecksIcon,
  MessageSquareTextIcon,
  ReceiptTextIcon,
  ScrollTextIcon,
  SparklesIcon,
  TypeIcon,
  UserRoundIcon,
} from "lucide-react"

import { ChoiceField } from "@/components/forms/choice-field"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { FormSection } from "@/components/forms/form-section"
import { TextareaField } from "@/components/forms/textarea-field"
import { LineItemsEditor, newLine, type EditableLine } from "@/components/finance/line-items-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { generateProposalDraft, saveInvoice, saveProposal } from "@/lib/actions/finance"
import { currencyItems } from "@/lib/finance/constants"
import type { CatalogServiceDTO, LineItemDTO } from "@/lib/finance/types"

export const toEditableLines = (items: LineItemDTO[]) =>
  items.length ? items.map((i) => newLine({ serviceId: i.serviceId, description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice) })) : [newLine()]

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
        <CardContent>
          <FormSection icon={ReceiptTextIcon} title="Invoice details" description="Who you're billing, when it was issued and when payment is due.">
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <ChoiceField
                label="Client"
                icon={BuildingIcon}
                name="clientId"
                id="invoice-client"
                value={clientId}
                onChange={(v) => {
                  setClientId(v)
                  setProjectId("none")
                }}
                items={clients.map((c) => ({ value: c.id, label: c.name }))}
                hint="The invoice is addressed and emailed to this client."
                error={errors?.clientId?.[0]}
              />
              <ChoiceField
                label="Project"
                icon={FolderKanbanIcon}
                optional
                name="projectId"
                id="invoice-project"
                value={projectId}
                onChange={setProjectId}
                items={[{ value: "none", label: "No project" }, ...clientProjects.map((p) => ({ value: p.id, label: p.name }))]}
                hint="Links the invoice to a project, for reporting."
                error={errors?.projectId?.[0]}
              />
              <ChoiceField
                label="Currency"
                icon={CoinsIcon}
                name="currency"
                id="invoice-currency"
                value={doc.currency}
                onChange={doc.setCurrency}
                items={currencyItems}
                disabled={currencyLocked}
                hint={currencyLocked ? "Fixed once a payment has been recorded." : "Every amount on this invoice is in this currency."}
                error={errors?.currency?.[0]}
              />
              {currencyLocked && <input type="hidden" name="currency" value={doc.currency} />}
              <FormField
                label="Issue date"
                icon={CalendarIcon}
                name="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                hint="The date printed on the invoice."
                errors={errors?.issueDate}
              />
              <FormField
                label="Due date"
                icon={CalendarClockIcon}
                name="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                hint="After this date it's marked overdue and reminders can go out."
                errors={errors?.dueDate}
              />
            </div>
          </FormSection>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <FormSection icon={ListChecksIcon} title="Line items" description="What you're charging for. Each line is quantity × unit price; discount and tax are applied to the total below.">
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
          </FormSection>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <FormSection icon={MessageSquareTextIcon} title="Notes for the client" description="Printed at the bottom of the invoice the client sees.">
            <TextareaField
              label="Notes"
              optional
              name="notes"
              id="doc-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Thanks for your business! This covers the homepage redesign (phase 1)."
              hint="e.g. a thank-you, the scope covered, or a PO number. Payment instructions from Settings → Billing are added automatically."
            />
          </FormSection>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto text-xs text-muted-foreground">{invoiceId ? "Changes show on the client's link straight away." : "Saved as a draft. You can review it before sending."}</p>
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
  const [aiError, setAiError] = React.useState<string | null>(null)
  const [aiPending, startAiTransition] = React.useTransition()

  function generateDraft() {
    setAiError(null)
    startAiTransition(async () => {
      const result = await generateProposalDraft(recipient, doc.lines.map((line) => line.description).filter(Boolean))
      if (!result.ok) return setAiError(result.error)
      setTitle(result.draft.title)
      setIntroduction(result.draft.introduction)
      setTerms(result.draft.terms)
    })
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {proposalId && <input type="hidden" name="proposalId" value={proposalId} />}
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {aiError && <FormAlert tone="error">{aiError}</FormAlert>}

      <Card>
        <CardContent>
          <FormSection
            icon={FileSignatureIcon}
            title="Proposal details"
            description="Who it's for, what it's called, and how long the offer stands."
            aside={
              <Button type="button" variant="secondary" size="sm" disabled={aiPending} onClick={generateDraft}>
                <SparklesIcon data-icon="inline-start" className={aiPending ? "animate-pulse" : undefined} />
                {aiPending ? "Drafting…" : "Draft with Klyron AI"}
              </Button>
            }
          >
            <FormField
              label="Title"
              icon={TypeIcon}
              required
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Website redesign"
              maxLength={160}
              hint="The headline the recipient sees first."
              errors={errors?.title}
            />
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <ChoiceField
                label="For"
                icon={UserRoundIcon}
                name="recipient"
                id="proposal-recipient"
                value={recipient}
                onChange={setRecipient}
                items={recipients}
                hint="A client, or a lead that isn't a client yet."
                error={errors?.recipient?.[0]}
              />
              <ChoiceField
                label="Currency"
                icon={CoinsIcon}
                name="currency"
                id="proposal-currency"
                value={doc.currency}
                onChange={doc.setCurrency}
                items={currencyItems}
                hint="Every amount in this proposal is in this currency."
                error={errors?.currency?.[0]}
              />
              <FormField
                label="Issue date"
                icon={CalendarIcon}
                name="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                hint="The date printed on the proposal."
                errors={errors?.issueDate}
              />
              <FormField
                label="Valid until"
                icon={CalendarCheckIcon}
                optional
                name="validUntil"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                hint="After this date it can no longer be accepted online."
                errors={errors?.validUntil}
              />
            </div>
            <TextareaField
              label="Introduction"
              icon={MessageSquareTextIcon}
              optional
              name="introduction"
              id="doc-introduction"
              rows={4}
              value={introduction}
              onChange={(e) => setIntroduction(e.target.value)}
              placeholder="Thanks for the chat last week. Here's how we'd approach your new website…"
              hint="The pitch: goals, approach and what's included. Shown above the price."
            />
          </FormSection>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <FormSection icon={ListChecksIcon} title="Pricing" description="What's included and what it costs. Each line is quantity × unit price; discount and tax apply to the total.">
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
          </FormSection>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <FormSection icon={ScrollTextIcon} title="Terms" description="The conditions the recipient agrees to when they accept.">
            <TextareaField
              label="Terms"
              optional
              name="terms"
              id="doc-terms"
              rows={4}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder={"50% upfront, 50% on launch.\nTwo rounds of revisions included.\nTimeline: 4 weeks from kickoff."}
              hint="Payment schedule, revisions, timelines, ownership."
            />
          </FormSection>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto text-xs text-muted-foreground">{proposalId ? "Changes show on the recipient's link straight away." : "Saved as a draft. You can review it before sending."}</p>
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
