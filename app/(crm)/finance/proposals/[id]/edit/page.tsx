import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { ProposalForm } from "@/components/finance/document-forms"
import { requirePermission } from "@/lib/auth/dal"
import { getCatalog, getProposal } from "@/lib/finance/queries"
import { getProposalRecipients } from "@/lib/finance/recipients"

export const metadata: Metadata = { title: "Edit proposal" }

export default async function EditProposalPage({ params }: PageProps<"/finance/proposals/[id]/edit">) {
  await requirePermission("finance", "WRITE")
  const { id } = await params
  const proposal = await getProposal(id)
  if (!proposal) notFound()
  if (proposal.status === "ACCEPTED" || proposal.status === "DECLINED") redirect(`/finance/proposals/${id}`)

  const current = proposal.recipient ? `${proposal.recipient.kind}:${proposal.recipient.id}` : ""
  const [recipients, catalog] = await Promise.all([getProposalRecipients(current), getCatalog()])

  return (
    <section aria-labelledby="edit-proposal" className="flex flex-col gap-4">
      <div>
        <h2 id="edit-proposal" className="text-lg font-semibold">Edit {proposal.number}</h2>
        {proposal.status === "SENT" && (
          <p className="text-sm text-muted-foreground">Already sent: the recipient&rsquo;s link shows your changes straight away.</p>
        )}
      </div>
      <ProposalForm
        proposalId={proposal.id}
        recipients={recipients}
        catalog={catalog}
        cancelHref={`/finance/proposals/${proposal.id}`}
        initial={{
          recipient: current || recipients[0]?.value || "",
          title: proposal.title,
          currency: proposal.currency,
          issueDate: proposal.issueDate,
          validUntil: proposal.validUntil ?? "",
          introduction: proposal.introduction ?? "",
          terms: proposal.terms ?? "",
          discount: proposal.totals.discount,
          taxRate: proposal.totals.taxRate,
          items: proposal.items,
        }}
      />
    </section>
  )
}
