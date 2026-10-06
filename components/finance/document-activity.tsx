import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/db"
import { formatDateTime, formatRelative } from "@/lib/format"

type Meta = Record<string, unknown>

const text: Record<string, (m: Meta) => string> = {
  "invoice.create": (m) => (m.fromProposal ? `created it from ${m.fromProposal}` : "created the draft"),
  "invoice.update": () => "edited the invoice",
  "invoice.send": (m) => `emailed it to ${m.recipients} ${m.recipients === 1 ? "address" : "addresses"}`,
  "invoice.mark_sent": () => "marked it as sent",
  "invoice.view": () => "opened the link",
  "invoice.reminder": () => "sent a payment reminder",
  "invoice.reminder.auto": () => "sent an automatic overdue reminder",
  "invoice.payment": (m) => `recorded a payment of ${m.amount} ${m.currency}${m.paid ? " (paid in full)" : ""}`,
  "invoice.payment.delete": (m) => `removed a payment of ${m.amount} ${m.currency}`,
  "invoice.void": () => "voided the invoice",
  "proposal.create": () => "created the draft",
  "proposal.update": (m) => (m.client ? `moved it to ${m.client}` : "edited the proposal"),
  "proposal.send": (m) => `emailed it to ${m.recipients} ${m.recipients === 1 ? "address" : "addresses"}`,
  "proposal.mark_sent": () => "marked it as sent",
  "proposal.view": () => "opened the link",
  "proposal.accept": (m) => (m.by === "recipient" ? "accepted the proposal" : "marked it accepted"),
  "proposal.decline": (m) => (m.by === "recipient" ? "declined the proposal" : "marked it declined"),
}

/** Timeline from the event log for an invoice or proposal. */
async function DocumentActivity({ entityType, entityId }: { entityType: "invoice" | "proposal"; entityId: string }) {
  const events = await db.event.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "desc" }, take: 30 })
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base font-semibold">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {events.map((e) => {
              const describe = text[e.action]
              const meta = (e.metadata as Meta) ?? {}
              return (
                <li key={e.id} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{e.actorName ?? "Client"}</span> {describe ? describe(meta) : e.action}{" "}
                  <time suppressHydrationWarning dateTime={e.createdAt.toISOString()} title={formatDateTime(e.createdAt)} className="text-xs">
                    · {formatRelative(e.createdAt)}
                  </time>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

export { DocumentActivity }
