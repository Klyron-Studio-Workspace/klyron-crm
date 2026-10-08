"use client"

import * as React from "react"
import { CheckIcon, CopyIcon, SparklesIcon } from "lucide-react"

import { FormAlert } from "@/components/forms/form-alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { analyzeLead } from "@/lib/actions/leads"
import type { LeadInsights } from "@/lib/leads/ai-result"

function LeadAiCard({ leadId }: { leadId: string }) {
  const [pending, startTransition] = React.useTransition()
  const [insights, setInsights] = React.useState<LeadInsights | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  function generate() {
    setError(null)
    startTransition(async () => {
      const result = await analyzeLead(leadId)
      if (result.ok) setInsights(result.insights)
      else setError(result.error)
    })
  }

  async function copy() {
    if (!insights) return
    await navigator.clipboard.writeText(insights.followUp)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <SparklesIcon aria-hidden className="size-4 text-primary" />
          Klyron AI
        </CardTitle>
        <CardDescription>Score this lead and draft the next follow-up from its activity.</CardDescription>
      </CardHeader>
      <CardContent className="gap-4">
        {error && <FormAlert tone="error">{error}</FormAlert>}
        {!insights ? (
          <Button variant="secondary" size="sm" className="w-fit" disabled={pending} onClick={generate}>
            <SparklesIcon data-icon="inline-start" className={pending ? "animate-pulse" : undefined} />
            {pending ? "Analyzing…" : "Analyze lead"}
          </Button>
        ) : (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-3xl font-semibold tabular-nums">{insights.score}</span>
              <span className="text-muted-foreground">/ 100 readiness</span>
            </div>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {insights.rationale.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Next step</p>
              <p>{insights.nextStep}</p>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Draft follow-up</p>
                <Button variant="ghost" size="xs" onClick={copy}>
                  {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="rounded-lg border border-border bg-surface p-3 whitespace-pre-wrap">{insights.followUp}</p>
            </div>
            <Button variant="ghost" size="sm" className="w-fit" disabled={pending} onClick={generate}>Regenerate</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { LeadAiCard }
