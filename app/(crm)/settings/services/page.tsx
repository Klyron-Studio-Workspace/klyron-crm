import type { Metadata } from "next"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requirePermission } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { getServices } from "@/lib/leads/queries"
import { ServiceEditor, type ServiceRow } from "./service-editor"

export const metadata: Metadata = { title: "Services" }

export default async function ServicesSettingsPage() {
  await requirePermission("settings", "WRITE")
  const [services, counts, prices] = await Promise.all([
    getServices({ includeInactive: true }),
    db.leadService.groupBy({ by: ["serviceId"], _count: { _all: true } }),
    db.service.findMany({ select: { id: true, price: true, priceUnit: true } }),
  ])
  const priceById = new Map(prices.map((p) => [p.id, p]))
  const countByService = new Map(counts.map((c) => [c.serviceId, c._count._all]))
  const rows: ServiceRow[] = services.map((s) => {
    const priced = priceById.get(s.id)
    return {
      ...s,
      leadCount: countByService.get(s.id) ?? 0,
      price: priced?.price == null ? "" : String(Number(priced.price)),
      priceUnit: priced?.priceUnit ?? "FIXED",
    }
  })

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base font-semibold">Services</CardTitle>
        <CardDescription>
          What the studio sells. Leads track which services they&rsquo;re interested in; prices pre-fill proposal and invoice lines (in your default currency).
          Archive a service that&rsquo;s in use to hide it from new leads.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ServiceEditor services={rows} />
      </CardContent>
    </Card>
  )
}
