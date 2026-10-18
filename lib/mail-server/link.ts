/**
 * Given a set of email addresses, find the first matching Client or Lead.
 * Client match takes priority. Returns ids to set on the EmailThread.
 */
export async function resolveLinks(addresses: string[]): Promise<{
  linkedClientId: string | null
  linkedLeadId: string | null
}> {
  const { db } = await import("@/lib/db")
  const normalized = addresses.map((a) => a.toLowerCase().trim())

  const client = await db.client.findFirst({
    where: { email: { in: normalized } },
    select: { id: true },
  })
  if (client) return { linkedClientId: client.id, linkedLeadId: null }

  const lead = await db.lead.findFirst({
    where: { email: { in: normalized } },
    select: { id: true },
  })
  return { linkedClientId: null, linkedLeadId: lead?.id ?? null }
}
