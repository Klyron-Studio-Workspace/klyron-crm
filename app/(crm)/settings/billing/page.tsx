import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { can, requirePermission } from "@/lib/auth/dal"
import { getOrgBilling } from "@/lib/finance/queries"
import { SignaturePad } from "@/components/finance/signature-pad"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BillingSettingsForm } from "./billing-settings-form"

export const metadata: Metadata = { title: "Billing settings" }

export default async function BillingSettingsPage() {
  const user = await requirePermission("settings", "WRITE")
  if (!(await can(user, "finance", "WRITE"))) notFound()
  const org = await getOrgBilling()
  const pad = (n: number) => String(n + 1).padStart(4, "0")

  return (
    <div className="flex flex-col gap-6">
      <BillingSettingsForm
        values={{
          address: org.address ?? "",
          paymentInstructions: org.paymentInstructions ?? "",
          defaultTaxRate: String(org.defaultTaxRate),
          paymentTermsDays: String(org.paymentTermsDays),
          invoicePrefix: org.invoicePrefix,
          proposalPrefix: org.proposalPrefix,
          autoPaymentReminders: org.autoPaymentReminders,
          nextInvoice: pad(org.invoiceSeq),
          nextProposal: pad(org.proposalSeq),
        }}
      />
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base font-semibold">Signature</CardTitle>
          <CardDescription>Drawn with your mouse or trackpad. Saved as SVG and printed on invoices and proposals.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <SignaturePad existing={org.signatureSvg ?? null} />
        </CardContent>
      </Card>
    </div>
  )
}
