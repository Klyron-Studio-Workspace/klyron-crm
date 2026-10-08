"use client"

import * as React from "react"
import { RefreshCwIcon, SparklesIcon } from "lucide-react"

import { FormAlert } from "@/components/forms/form-alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { analyzeProject } from "@/lib/actions/projects"
import type { ProjectInsights } from "@/lib/projects/ai-result"

const health = {
  ON_TRACK: { label: "On track", className: "bg-success-tint text-success" },
  AT_RISK: { label: "At risk", className: "bg-warning-tint text-warning" },
  BLOCKED: { label: "Blocked", className: "bg-destructive-tint text-primary-strong" },
}

function ProjectAiCard({ projectId }: { projectId: string }) {
  const [pending, startTransition] = React.useTransition()
  const [insights, setInsights] = React.useState<ProjectInsights | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  function generate() {
    setError(null)
    startTransition(async () => {
      const result = await analyzeProject(projectId)
      if (result.ok) setInsights(result.insights)
      else setError(result.error)
    })
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <SparklesIcon aria-hidden className="size-4 text-primary" /> Klyron AI
        </CardTitle>
        <CardDescription>Status summary and delivery risks from current project data.</CardDescription>
      </CardHeader>
      <CardContent className="gap-4">
        {error && <FormAlert tone="error">{error}</FormAlert>}
        {!insights ? (
          <Button variant="secondary" size="sm" className="w-fit" disabled={pending} onClick={generate}>
            <SparklesIcon data-icon="inline-start" className={pending ? "animate-pulse" : undefined} />
            {pending ? "Reviewing…" : "Summarize project"}
          </Button>
        ) : (
          <div className="flex flex-col gap-4 text-sm">
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${health[insights.health].className}`}>
              {health[insights.health].label}
            </span>
            <p className="leading-relaxed whitespace-pre-wrap">{insights.summary}</p>
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Risks and actions</h3>
              {insights.risks.length ? (
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {insights.risks.map((item, index) => (
                    <li key={`${item.risk}-${index}`} className="p-3">
                      <p className="font-medium">{item.risk}</p>
                      <p className="mt-1 text-muted-foreground">{item.action}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground">No current risks found.</p>}
            </section>
            <Button variant="ghost" size="sm" className="w-fit" disabled={pending} onClick={generate}>
              <RefreshCwIcon data-icon="inline-start" className={pending ? "animate-spin" : undefined} /> Regenerate
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { ProjectAiCard }
