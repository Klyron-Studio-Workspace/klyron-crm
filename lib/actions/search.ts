"use server"

import { can, requireTeamUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { leadScope } from "@/lib/leads/queries"
import { projectScope } from "@/lib/projects/queries"

export type SearchHit = {
  id: string
  kind: "lead" | "client" | "project" | "invoice"
  label: string
  detail: string | null
  href: string
}

const PER_KIND = 5

/** Quick search for the command palette. Respects module access and "assigned work only". */
export async function searchRecords(raw: string): Promise<SearchHit[]> {
  const user = await requireTeamUser()
  const q = raw.trim().slice(0, 80)
  if (q.length < 2) return []

  const [leads, clients, projects, finance] = await Promise.all([
    can(user, "leads", "READ"),
    can(user, "clients", "READ"),
    can(user, "projects", "READ"),
    can(user, "finance", "READ"),
  ])

  const [leadRows, clientRows, projectRows, invoiceRows] = await Promise.all([
    leads
      ? db.lead.findMany({
          where: {
            AND: [
              await leadScope(user),
              { OR: [{ name: { contains: q } }, { company: { contains: q } }, { email: { contains: q } }] },
            ],
          },
          select: { id: true, name: true, company: true },
          orderBy: { updatedAt: "desc" },
          take: PER_KIND,
        })
      : [],
    clients
      ? db.client.findMany({
          where: { OR: [{ name: { contains: q } }, { contactName: { contains: q } }, { email: { contains: q } }] },
          select: { id: true, name: true, contactName: true },
          orderBy: { updatedAt: "desc" },
          take: PER_KIND,
        })
      : [],
    projects
      ? db.project.findMany({
          where: { AND: [await projectScope(user), { name: { contains: q } }] },
          select: { id: true, name: true, client: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
          take: PER_KIND,
        })
      : [],
    finance
      ? db.invoice.findMany({
          where: { OR: [{ number: { contains: q } }, { client: { name: { contains: q } } }] },
          select: { id: true, number: true, client: { select: { name: true } } },
          orderBy: { issueDate: "desc" },
          take: PER_KIND,
        })
      : [],
  ])

  return [
    ...leadRows.map((l) => ({ id: l.id, kind: "lead" as const, label: l.name, detail: l.company, href: `/leads/${l.id}` })),
    ...clientRows.map((c) => ({ id: c.id, kind: "client" as const, label: c.name, detail: c.contactName, href: `/clients/${c.id}` })),
    ...projectRows.map((p) => ({ id: p.id, kind: "project" as const, label: p.name, detail: p.client?.name ?? null, href: `/projects/${p.id}` })),
    ...invoiceRows.map((i) => ({ id: i.id, kind: "invoice" as const, label: i.number, detail: i.client.name, href: `/finance/invoices/${i.id}` })),
  ]
}
