import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, BuildingIcon, GlobeIcon, MailIcon, PhoneIcon } from "lucide-react"

import { FollowUps } from "@/components/leads/follow-ups"
import { BillingCard } from "@/components/finance/billing-card"
import { LeadActions } from "@/components/leads/lead-actions"
import { LeadAiCard } from "@/components/leads/lead-ai-card"
import { LeadTimeline } from "@/components/leads/lead-timeline"
import { NoteComposer } from "@/components/leads/note-composer"
import { StageBadge } from "@/components/leads/stage-badge"
import { StageControl } from "@/components/leads/stage-control"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { can, requirePermission } from "@/lib/auth/dal"
import { formatDate } from "@/lib/format"
import { lostReasonLabel, sourceLabels } from "@/lib/leads/constants"
import { getAssignableMembers, getLeadDetail, getServices, getStages, leadScope } from "@/lib/leads/queries"
import { formatMoney } from "@/lib/money"
import { getLeadEmails } from "@/lib/actions/mail"
import { EmailsTab } from "@/components/mail/emails-tab"

export const metadata: Metadata = { title: "Lead" }

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

export default async function LeadPage({ params }: PageProps<"/leads/[id]">) {
  const user = await requirePermission("leads", "READ")
  const { id } = await params
  const lead = await getLeadDetail(user, id)
  if (!lead) notFound()

  const emails = await getLeadEmails(lead.id)
  const [canWrite, canConvert, stages, members, services, scope, canFinance, canFinanceWrite] = await Promise.all([
    can(user, "leads", "WRITE"),
    can(user, "clients", "WRITE"),
    getStages(),
    getAssignableMembers(),
    getServices({ includeInactive: true }),
    leadScope(user),
    can(user, "finance", "READ"),
    can(user, "finance", "WRITE"),
  ])
  const title = lead.company ?? lead.name
  const leadServices = services.filter((s) => lead.serviceIds.includes(s.id))

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link href="/leads" className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon aria-hidden className="size-4" />
          Leads
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {lead.company && <span>{lead.name}</span>}
              <span className="font-heading font-semibold text-foreground tabular-nums">
                {formatMoney(lead.value, lead.currency)}
              </span>
              <span>{lead.owner ? `Owned by ${lead.owner.name}` : "Unassigned"}</span>
              {lead.client && (
                <span className="inline-flex items-center gap-1 text-success">
                  <BuildingIcon aria-hidden className="size-3.5" /> Client since {formatDate(new Date(lead.closedAt ?? lead.createdAt))}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canWrite ? (
              <StageControl leadId={lead.id} leadName={title} stageId={lead.stage.id} stages={stages} />
            ) : (
              <StageBadge name={lead.stage.name} tone={lead.stage.tone} />
            )}
            {canWrite && (
              <LeadActions
                leadId={lead.id}
                leadName={title}
                converted={Boolean(lead.client)}
                canConvert={canConvert}
                canDelete={user.role !== "MEMBER"}
                ownerLocked={Boolean(scope.ownerId)}
                form={{
                  stages,
                  members,
                  services: services.filter((s) => s.active || lead.serviceIds.includes(s.id)),
                  initial: {
                    name: lead.name,
                    company: lead.company ?? "",
                    email: lead.email ?? "",
                    phone: lead.phone ?? "",
                    website: lead.website ?? "",
                    source: lead.source,
                    value: String(lead.value),
                    currency: lead.currency,
                    ownerId: lead.owner?.id ?? "",
                    stageId: lead.stage.id,
                    serviceIds: lead.serviceIds,
                  },
                }}
              />
            )}
          </div>
        </div>
      </div>

      {lead.stage.kind === "LOST" && lead.lostReason && (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <span className="font-medium">Lost: {lostReasonLabel(lead.lostReason)}</span>
          {lead.lostDetail && <span className="text-muted-foreground"> — {lead.lostDetail}</span>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Activity" className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">Activity</h2>
          {canWrite && <NoteComposer leadId={lead.id} />}
          <LeadTimeline items={lead.timeline} currentUserId={user.id} canModerate={user.role !== "MEMBER"} />
        </section>

        <div className="flex flex-col gap-6">
          {canWrite && <LeadAiCard leadId={lead.id} />}
          {canFinance && !lead.client && <BillingCard leadId={lead.id} canWrite={canFinanceWrite} />}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Follow-ups</CardTitle>
            </CardHeader>
            <CardContent>
              <FollowUps
                leadId={lead.id}
                reminders={lead.reminders}
                members={members}
                currentUserId={user.id}
                canWrite={canWrite}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Emails</CardTitle>
            </CardHeader>
            <CardContent>
              <EmailsTab
                emails={emails as never}
                composeHref={`/mail?compose=1&to=${encodeURIComponent(lead.email ?? "")}`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col divide-y divide-border">
                <DetailRow label="Email">
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} className="link inline-flex items-center gap-1.5">
                      <MailIcon aria-hidden className="size-3.5" />
                      {lead.email}
                    </a>
                  ) : "—"}
                </DetailRow>
                <DetailRow label="Phone">
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="link inline-flex items-center gap-1.5">
                      <PhoneIcon aria-hidden className="size-3.5" />
                      {lead.phone}
                    </a>
                  ) : "—"}
                </DetailRow>
                <DetailRow label="Website">
                  {lead.website ? (
                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1.5">
                      <GlobeIcon aria-hidden className="size-3.5" />
                      {lead.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : "—"}
                </DetailRow>
                <DetailRow label="Source">{sourceLabels[lead.source]}</DetailRow>
                <DetailRow label="Services">
                  {leadServices.length ? (
                    <div className="flex flex-wrap gap-1">
                      {leadServices.map((s) => (
                        <span key={s.id} className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  ) : "—"}
                </DetailRow>
                <DetailRow label="Created">{formatDate(new Date(lead.createdAt))}</DetailRow>
                {lead.client && (
                  <DetailRow label="Client">
                    <Link href={`/clients/${lead.client.id}`} className="link">
                      {lead.client.name}
                    </Link>
                  </DetailRow>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
