import type { Metadata } from "next"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requirePermission } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { getStages } from "@/lib/leads/queries"
import { StageEditor, type StageRow } from "./stage-editor"

export const metadata: Metadata = { title: "Pipeline" }

export default async function PipelineSettingsPage() {
  await requirePermission("settings", "WRITE")
  const [stages, counts] = await Promise.all([
    getStages(),
    db.lead.groupBy({ by: ["stageId"], _count: { _all: true } }),
  ])
  const countByStage = new Map(counts.map((c) => [c.stageId, c._count._all]))
  const rows: StageRow[] = stages.map((s) => ({ ...s, leadCount: countByStage.get(s.id) ?? 0 }))

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base font-semibold">Pipeline stages</CardTitle>
        <CardDescription>
          The columns on the leads board, in order. Won and Lost close a deal; moving to Lost always asks for a reason.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StageEditor stages={rows} />
      </CardContent>
    </Card>
  )
}
