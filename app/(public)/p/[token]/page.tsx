import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DocumentView } from "@/components/finance/document-view"
import { PrintButton, ProposalResponse } from "@/components/finance/public-bits"
import { ProposalStatusBadge } from "@/components/finance/status-badge"
import { FormAlert } from "@/components/forms/form-alert"
import { getCurrentUser } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import { getOrgBilling, getProposalByToken } from "@/lib/finance/queries"
import { formatDateTime } from "@/lib/format"
import { recordFirstView } from "@/lib/finance/views"

export const metadata: Metadata = { title: "Proposal" }

/** The recipient's view of a proposal, where they accept or decline. */
export default async function PublicProposalPage({ params }: PageProps<"/p/[token]">) {
  const { token } = await params
  const [proposal, org, viewer] = await Promise.all([getProposalByToken(token), getOrgBilling(), getCurrentUser()])
  const isTeam = Boolean(viewer && isTeamRole(viewer.role))
  if (!proposal || (proposal.status === "DRAFT" && !isTeam)) notFound()
  await recordFirstView("proposal", proposal.id, Boolean(proposal.viewedAt))

  const canAnswer = proposal.displayStatus === "SENT" && !isTeam

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8 sm:px-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <ProposalStatusBadge status={proposal.displayStatus} />
        <PrintButton />
      </div>
      {isTeam && <FormAlert tone="error" className="print:hidden">Team preview. Only the recipient can accept or decline.</FormAlert>}
      {proposal.displayStatus === "EXPIRED" && <FormAlert tone="error">This proposal has expired. Please get in touch for an updated one.</FormAlert>}
      {proposal.status === "ACCEPTED" && proposal.respondedAt && (
        <FormAlert tone="success">Accepted on {formatDateTime(new Date(proposal.respondedAt))}. Thank you!</FormAlert>
      )}
      {proposal.status === "DECLINED" && <FormAlert tone="error">This proposal was declined.</FormAlert>}
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
      {canAnswer && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs print:hidden">
          <ProposalResponse token={token} />
        </div>
      )}
    </main>
  )
}
