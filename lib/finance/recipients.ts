import "server-only"

import { db } from "@/lib/db"

/** Who a proposal can be addressed to: clients, plus leads (not lost) that haven't become clients. */
export async function getProposalRecipients(include?: string) {
  const [clients, leads] = await Promise.all([
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.lead.findMany({
      where: { OR: [{ stage: { kind: { not: "LOST" } }, client: null }, ...(include?.startsWith("lead:") ? [{ id: include.slice(5) }] : [])] },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: { id: true, name: true, company: true },
    }),
  ])
  return [
    ...clients.map((c) => ({ value: `client:${c.id}`, label: c.name })),
    ...leads.map((l) => ({ value: `lead:${l.id}`, label: `${l.company ? `${l.company} (${l.name})` : l.name} · lead` })),
  ]
}
