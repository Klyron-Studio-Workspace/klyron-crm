/** Strip display name and normalise to lowercase. */
export function normalizeAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return (match ? match[1] : raw).trim().toLowerCase()
}

/** Ensure a Mailbox row exists for this user. Idempotent. */
export async function ensureMailbox(userId: string, name: string): Promise<string> {
  const localPart = name
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.|\.$/, "")
  const address = `${localPart}@klyronstudio.com`

  const { db } = await import("@/lib/db")
  const existing = await db.mailbox.findUnique({ where: { userId } })
  if (existing) return existing.id

  const mailbox = await db.mailbox.create({ data: { userId, address } })
  return mailbox.id
}

/** Resolve a recipient address to a mailbox id. Returns null if not found. */
export async function resolveMailbox(address: string): Promise<{ id: string; userId: string } | null> {
  const { db } = await import("@/lib/db")
  const normalized = normalizeAddress(address)
  const mailbox = await db.mailbox.findUnique({
    where: { address: normalized },
    select: { id: true, userId: true },
  })
  return mailbox
}
