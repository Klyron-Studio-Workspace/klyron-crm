export function normalizeSubject(raw: string): string {
  let s = raw.trim()
  // Strip up to 5 levels of Re:/Fwd:/Fw: prefixes
  for (let i = 0; i < 5; i++) {
    const stripped = s.replace(/^(Re|Fwd|Fw):\s*/i, "").trim()
    if (stripped === s) break
    s = stripped
  }
  return s
}

/**
 * Find an existing thread by In-Reply-To / References message IDs,
 * or create a new one. Updates lastEmailAt.
 */
export async function resolveThread(opts: {
  inReplyTo: string | null
  references: string[]
  subject: string
  receivedAt: Date
  linkedClientId: string | null
  linkedLeadId: string | null
}): Promise<string> {
  const { db } = await import("@/lib/db")
  const refIds = [opts.inReplyTo, ...opts.references].filter(Boolean) as string[]
  let threadId: string | null = null

  if (refIds.length > 0) {
    const parent = await db.email.findFirst({
      where: { messageId: { in: refIds } },
      select: { threadId: true },
    })
    threadId = parent?.threadId ?? null
  }

  if (threadId) {
    await db.emailThread.update({
      where: { id: threadId },
      data: {
        lastEmailAt: opts.receivedAt,
        ...(opts.linkedClientId ? { linkedClientId: opts.linkedClientId } : {}),
        ...(opts.linkedLeadId ? { linkedLeadId: opts.linkedLeadId } : {}),
      },
    })
    return threadId
  }

  const thread = await db.emailThread.create({
    data: {
      subject: normalizeSubject(opts.subject).slice(0, 255),
      lastEmailAt: opts.receivedAt,
      linkedClientId: opts.linkedClientId,
      linkedLeadId: opts.linkedLeadId,
    },
  })
  return thread.id
}
