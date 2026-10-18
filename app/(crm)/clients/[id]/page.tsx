import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, FolderOpenIcon, GlobeIcon, MailIcon, MessagesSquareIcon, PhoneIcon } from "lucide-react"

import { ClientAccounts } from "@/components/clients/client-accounts"
import { BillingCard } from "@/components/finance/billing-card"
import { ClientActions } from "@/components/clients/client-dialogs"
import { Button } from "@/components/ui/button"
import { NewProjectDialog } from "@/components/projects/new-project-dialog"
import { ProjectCard } from "@/components/projects/project-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { can, requirePermission } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { formatDate, formatDateTime, formatRelative } from "@/lib/format"
import { getAssignableMembers, getServices } from "@/lib/leads/queries"
import { getProjects } from "@/lib/projects/queries"
import { ensureClientChannel } from "@/lib/chat/access"
import { getClientEmails } from "@/lib/actions/mail"
import { EmailsTab } from "@/components/mail/emails-tab"

export const metadata: Metadata = { title: "Client" }

const clientEventText: Record<string, (m: Record<string, unknown>) => string> = {
  "client.create": () => "created the client",
  "client.update": (m) => `updated ${Array.isArray(m.fields) && m.fields.length ? (m.fields as string[]).join(", ") : "details"}`,
  "client.project.create": (m) => `started project “${m.name}”`,
  "project.delete": (m) => `deleted project “${m.name}”`,
  "client.invoice.create": (m) => `created invoice ${m.number}`,
  "client.proposal.create": (m) => `created proposal ${m.number}`,
  "client.account.create": (m) => `gave portal access to ${m.email}`,
  "client.account.remove": (m) => `removed portal access for ${m.email}`,
  "client.account.disable": (m) => `disabled portal sign-in for ${m.email}`,
  "client.account.enable": (m) => `re-enabled portal sign-in for ${m.email}`,
  "client.account.password_reset": (m) => `reset the portal password for ${m.email}`,
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const user = await requirePermission("clients", "READ")
  const { id } = await params
  const client = await db.client.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      lead: { select: { id: true } },
      accounts: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, status: true, lastLoginAt: true } },
    },
  })
  if (!client) notFound()

  const emails = await getClientEmails(client.id)
  const [canChat, canFiles, canFinance, canFinanceWrite] = await Promise.all([
    can(user, "chat", "READ"),
    can(user, "files", "READ"),
    can(user, "finance", "READ"),
    can(user, "finance", "WRITE"),
  ])
  const chatChannel = canChat ? await ensureClientChannel(client.id) : null
  const [canWrite, canSeeProjects, canCreateProjects, canSeeLeads, projects, members, services, events] = await Promise.all([
    can(user, "clients", "WRITE"),
    can(user, "projects", "READ"),
    can(user, "projects", "WRITE"),
    can(user, "leads", "READ"),
    getProjects(user, { clientId: client.id }),
    getAssignableMembers(),
    getServices(),
    db.event.findMany({ where: { entityType: "client", entityId: client.id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ])
  const canManageAccounts = canWrite && user.role !== "MEMBER"

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link href="/clients" className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon aria-hidden className="size-4" />
          Clients
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{client.name}</h1>
            <p className="text-sm text-muted-foreground">
              {[client.contactName, `Client since ${formatDate(client.createdAt)}`, client.owner ? `Account owner: ${client.owner.name}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {chatChannel && (
              <Button variant="secondary" nativeButton={false} render={<Link href={`/chat/${chatChannel.id}`} />}>
                <MessagesSquareIcon data-icon="inline-start" />
                Chat
              </Button>
            )}
            {canFiles && (
              <Button variant="secondary" nativeButton={false} render={<Link href={`/files?client=${client.id}`} />}>
                <FolderOpenIcon data-icon="inline-start" />
                Files
              </Button>
            )}
            {canSeeProjects && canCreateProjects && (
              <NewProjectDialog
                clients={[{ id: client.id, name: client.name }]}
                clientId={client.id}
                services={services}
                members={members}
                currentUserId={user.id}
              />
            )}
            {canWrite && (
              <ClientActions
                clientId={client.id}
                clientName={client.name}
                canDelete={user.role !== "MEMBER"}
                members={members}
                initial={{
                  name: client.name,
                  contactName: client.contactName ?? "",
                  email: client.email ?? "",
                  phone: client.phone ?? "",
                  website: client.website ?? "",
                  ownerId: client.owner?.id ?? "",
                  notes: client.notes ?? "",
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Projects" className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Projects</h2>
          {!canSeeProjects ? (
            <p className="text-sm text-muted-foreground">You don&rsquo;t have access to projects.</p>
          ) : projects.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              No projects yet{canCreateProjects ? ". Start one with “New project”." : "."}
            </p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <ProjectCard project={p} href={`/projects/${p.id}`} showClient={false} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col divide-y divide-border">
                <DetailRow label="Email">
                  {client.email ? (
                    <a href={`mailto:${client.email}`} className="link inline-flex items-center gap-1.5">
                      <MailIcon aria-hidden className="size-3.5" />
                      {client.email}
                    </a>
                  ) : "—"}
                </DetailRow>
                <DetailRow label="Phone">
                  {client.phone ? (
                    <a href={`tel:${client.phone}`} className="link inline-flex items-center gap-1.5">
                      <PhoneIcon aria-hidden className="size-3.5" />
                      {client.phone}
                    </a>
                  ) : "—"}
                </DetailRow>
                <DetailRow label="Website">
                  {client.website ? (
                    <a href={client.website} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1.5">
                      <GlobeIcon aria-hidden className="size-3.5" />
                      {client.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : "—"}
                </DetailRow>
                {client.lead && canSeeLeads && (
                  <DetailRow label="Origin">
                    <Link href={`/leads/${client.lead.id}`} className="link">
                      Lead history
                    </Link>
                  </DetailRow>
                )}
              </dl>
              {client.notes && <p className="mt-3 border-t border-border pt-3 text-sm whitespace-pre-wrap">{client.notes}</p>}
            </CardContent>
          </Card>

          {canFinance && <BillingCard clientId={client.id} canWrite={canFinanceWrite} />}

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Emails</CardTitle>
            </CardHeader>
            <CardContent>
              <EmailsTab
                emails={emails as never}
                composeHref={`/mail?compose=1&to=${encodeURIComponent(client.email ?? "")}`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Client portal</CardTitle>
            </CardHeader>
            <CardContent>
              <ClientAccounts
                clientId={client.id}
                clientName={client.name}
                canManage={canManageAccounts}
                accounts={client.accounts.map((a) => ({
                  id: a.id,
                  name: a.name,
                  email: a.email,
                  active: a.status === "ACTIVE",
                  lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
                }))}
              />
            </CardContent>
          </Card>

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
                    const describe = clientEventText[e.action]
                    return (
                      <li key={e.id} className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{e.actorName ?? "Someone"}</span>{" "}
                        {describe ? describe((e.metadata as Record<string, unknown>) ?? {}) : e.action}{" "}
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
        </div>
      </div>
    </>
  )
}
