import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { DocumentActivity } from "@/components/finance/document-activity"
import { DocumentView } from "@/components/finance/document-view"
import { ProposalActions } from "@/components/finance/proposal-actions"
import { ProposalStatusBadge } from "@/components/finance/status-badge"
import { FormAlert } from "@/components/forms/form-alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { can, requirePermission } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { getOrgBilling, getProposal } from "@/lib/finance/queries"
import { formatDateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Proposal" }

export default async function ProposalPage({ params }: PageProps<"/finance/proposals/[id]">) {
  const user = await requirePermission("finance", "READ")
  const { id } = await params
  const [proposal, org, canWrite] = await Promise.all([getProposal(id), getOrgBilling(), can(user, "finance", "WRITE")])
  if (!proposal) notFound()

  const forClient = proposal.recipient?.kind === "client"
  const convertedClient =
    proposal.recipient?.kind === "lead"
      ? (await db.lead.findUnique({ where: { id: proposal.recipient.id }, select: { client: { select: { name: true } } } }))?.client ?? null
      : null
  const recipientHref = proposal.recipient ? `/${proposal.recipient.kind === "client" ? "clients" : "leads"}/${proposal.recipient.id}` : null

  const facts = [
    { label: "Created", value: `${formatDateTime(new Date(proposal.createdAt))}${proposal.createdBy ? ` by ${proposal.createdBy}` : ""}` },
    proposal.sentAt && { label: "Sent", value: formatDateTime(new Date(proposal.sentAt)) },
    proposal.viewedAt && { label: "First viewed", value: formatDateTime(new Date(proposal.viewedAt)) },
    proposal.respondedAt && { label: "Answered", value: formatDateTime(new Date(proposal.respondedAt)) },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link href="/finance/proposals" className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon aria-hidden className="size-4" />
          Proposals
        </Link>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-2xl font-semibold tracking-tight">{proposal.title}</h2>
              <ProposalStatusBadge status={proposal.displayStatus} />
            </div>
            <p className="text-sm text-muted-foreground">
              {proposal.number}
              {proposal.recipient && recipientHref && (
                <>
                  {" · for "}
                  <Link href={recipientHref} className="link">
                    {proposal.recipient.name}
                  </Link>
                  {proposal.recipient.kind === "lead" && " (lead)"}
                </>
              )}
              {proposal.invoices.map((inv) => (
                <span key={inv.id}>
                  {" · invoiced as "}
                  <Link href={`/finance/invoices/${inv.id}`} className="link">
                    {inv.number}
                  </Link>
                </span>
              ))}
            </p>
          </div>
          {canWrite && (
            <ProposalActions
              proposalId={proposal.id}
              number={proposal.number}
              status={proposal.status}
              publicPath={`/p/${proposal.publicToken}`}
              forClient={forClient}
              convertedClientName={convertedClient?.name ?? null}
            />
          )}
        </div>
      </div>

      {proposal.status === "ACCEPTED" && !forClient && (
        <FormAlert tone="success">
          Accepted. Convert the lead to a client from its lead page{convertedClient ? "" : " first"}, then move this proposal to the client to invoice it.
        </FormAlert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <DocumentView
          kind="proposal"
          number={proposal.number}
          title={proposal.title}
          studio={org.studio}
          billTo={proposal.billTo}
          currency={proposal.currency}
          dates={[
            { label: "Issued", value: proposal.issueDate },
            { label: "Valid until", value: proposal.validUntil },
          ]}
          items={proposal.items}
          totals={proposal.totals}
          introduction={proposal.introduction}
          terms={proposal.terms}
        />

        <div className="flex flex-col gap-6">
          {proposal.responseNote && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base font-semibold">Their answer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{proposal.responseNote}</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2 text-sm">
                {facts.map((f) => (
                  <div key={f.label} className="grid grid-cols-[6.5rem_1fr] gap-3">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <DocumentActivity entityType="proposal" entityId={proposal.id} />
        </div>
      </div>
    </>
  )
}
