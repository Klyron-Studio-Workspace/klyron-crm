"use client"

import * as React from "react"
import { useActionState } from "react"
import { CheckIcon, PrinterIcon, XIcon } from "lucide-react"

import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { respondToProposal } from "@/lib/actions/finance"

function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <PrinterIcon data-icon="inline-start" />
      Print / Save PDF
    </Button>
  )
}

/** Triggers window.print() once on mount — used when ?pdf=1 is in the URL. */
function AutoPrint() {
  React.useEffect(() => { window.print() }, [])
  return null
}

/** Accept or decline, typed name as the signature. */
function ProposalResponse({ token }: { token: string }) {
  const [state, action, pending] = useActionState(respondToProposal, undefined)
  const [decision, setDecision] = React.useState<"ACCEPTED" | "DECLINED" | null>(null)
  const [name, setName] = React.useState("")
  const [note, setNote] = React.useState("")

  if (state?.ok) return <FormAlert tone="success">{state.message}</FormAlert>

  if (!decision) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Ready to go ahead?</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setDecision("DECLINED")}>
            <XIcon data-icon="inline-start" />
            Decline
          </Button>
          <Button onClick={() => setDecision("ACCEPTED")}>
            <CheckIcon data-icon="inline-start" />
            Accept proposal
          </Button>
        </div>
      </div>
    )
  }

  const accepting = decision === "ACCEPTED"
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="decision" value={decision} />
      <h2 className="text-base font-semibold">{accepting ? "Accept this proposal" : "Decline this proposal"}</h2>
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <FormField
        label="Your full name"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        maxLength={120}
        hint={accepting ? "Typing your name confirms you accept the scope, price and terms above." : undefined}
        errors={state?.fieldErrors?.name}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="response-note">{accepting ? "Anything we should know? (optional)" : "Can you tell us why? (optional)"}</Label>
        <Textarea id="response-note" name="note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => setDecision(null)}>
          Back
        </Button>
        <Button type="submit" variant={accepting ? "default" : "destructive"} disabled={pending}>
          {pending ? "Sending…" : accepting ? "Accept proposal" : "Decline proposal"}
        </Button>
      </div>
    </form>
  )
}

export { AutoPrint, PrintButton, ProposalResponse }
