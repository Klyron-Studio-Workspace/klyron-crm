"use client"

import * as React from "react"
import { useActionState } from "react"

import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateBillingSettings } from "@/lib/actions/finance"

export type BillingValues = {
  address: string
  paymentInstructions: string
  defaultTaxRate: string
  paymentTermsDays: string
  invoicePrefix: string
  proposalPrefix: string
  autoPaymentReminders: boolean
  nextInvoice: string
  nextProposal: string
}

function BillingSettingsForm({ values }: { values: BillingValues }) {
  const [state, action, pending] = useActionState(updateBillingSettings, undefined)
  const errors = state?.fieldErrors
  const [v, setV] = React.useState(values)
  const set = (key: keyof BillingValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((prev) => ({ ...prev, [key]: e.target.value }))

  return (
    <form action={action} noValidate>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base font-semibold">Billing</CardTitle>
          <CardDescription>Printed on every invoice and proposal. The studio name, email and default currency are under General.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
          {state?.ok && <FormAlert tone="success">{state.message}</FormAlert>}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="billing-address">Studio address</Label>
              <Textarea id="billing-address" name="address" rows={4} maxLength={1000} value={v.address} onChange={set("address")} placeholder={"Klyron Studio\nStreet, City\nCountry\nTax ID"} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="billing-instructions">How clients pay you</Label>
              <Textarea id="billing-instructions" name="paymentInstructions" rows={4} maxLength={2000} value={v.paymentInstructions} onChange={set("paymentInstructions")} placeholder={"Bank: …\nAccount title: …\nIBAN: …\nSWIFT: …"} />
              <p className="text-xs text-muted-foreground">Shown on unpaid invoices.</p>
            </div>
            <FormField label="Default tax rate (%)" name="defaultTaxRate" inputMode="decimal" value={v.defaultTaxRate} onChange={set("defaultTaxRate")} errors={errors?.defaultTaxRate} hint="Pre-filled on new documents; change it per document." />
            <FormField label="Payment terms (days)" name="paymentTermsDays" inputMode="numeric" value={v.paymentTermsDays} onChange={set("paymentTermsDays")} errors={errors?.paymentTermsDays} hint="New invoices are due this many days after they're issued." />
            <FormField label="Invoice number prefix" name="invoicePrefix" value={v.invoicePrefix} onChange={set("invoicePrefix")} maxLength={10} errors={errors?.invoicePrefix} hint={`Next invoice: ${v.invoicePrefix.toUpperCase() || "INV"}-${v.nextInvoice}`} />
            <FormField label="Proposal number prefix" name="proposalPrefix" value={v.proposalPrefix} onChange={set("proposalPrefix")} maxLength={10} errors={errors?.proposalPrefix} hint={`Next proposal: ${v.proposalPrefix.toUpperCase() || "PRO"}-${v.nextProposal}`} />
            <label className="flex items-start gap-3 rounded-lg border border-border p-4 sm:col-span-2">
              <input
                type="checkbox"
                name="autoPaymentReminders"
                checked={v.autoPaymentReminders}
                onChange={(e) => setV((prev) => ({ ...prev, autoPaymentReminders: e.target.checked }))}
                className="mt-0.5 size-4 accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Automatic payment reminders</span>
                <span className="text-sm text-muted-foreground">
                  Email clients when an invoice becomes overdue, then weekly, up to three reminders. Owners and Admins are notified too.
                </span>
              </span>
            </label>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

export { BillingSettingsForm }
