"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRightLeftIcon,
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { CopyLinkButton, useRunAction } from "@/components/finance/invoice-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  deleteProposal,
  invoiceFromProposal,
  moveProposalToClient,
  sendProposal,
  setProposalOutcome,
} from "@/lib/actions/finance"

type ProposalActionsProps = {
  proposalId: string
  number: string
  status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED"
  publicPath: string
  forClient: boolean
  /** The lead behind a lead proposal has become a client. */
  convertedClientName: string | null
}

function ProposalActions({ proposalId, number, status, publicPath, forClient, convertedClientName }: ProposalActionsProps) {
  const { run, pending } = useRunAction()
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const answered = status === "ACCEPTED" || status === "DECLINED"

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && (
        <Button disabled={pending} onClick={() => run(() => sendProposal(proposalId, { email: true }), "Couldn't send proposal")}>
          <SendIcon data-icon="inline-start" />
          Send
        </Button>
      )}
      {status === "ACCEPTED" && forClient && (
        <Button disabled={pending} onClick={() => run(() => invoiceFromProposal(proposalId), "Couldn't create invoice")}>
          <FileTextIcon data-icon="inline-start" />
          Create invoice
        </Button>
      )}
      {!forClient && convertedClientName && (
        <Button variant="secondary" disabled={pending} onClick={() => run(() => moveProposalToClient(proposalId), "Couldn't move proposal")}>
          <ArrowRightLeftIcon data-icon="inline-start" />
          Move to {convertedClientName}
        </Button>
      )}
      <Button variant="secondary" nativeButton={false} render={<a href={publicPath} target="_blank" rel="noopener noreferrer" />}>
        <ExternalLinkIcon data-icon="inline-start" />
        View / PDF
      </Button>
      <CopyLinkButton path={publicPath} />
      {!answered && (
        <Button variant="secondary" nativeButton={false} render={<Link href={`/finance/proposals/${proposalId}/edit`} />}>
          <PencilIcon data-icon="inline-start" />
          Edit
        </Button>
      )}
      {!answered && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="More proposal actions" />}>
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {status === "DRAFT" && (
              <DropdownMenuItem onClick={() => run(() => sendProposal(proposalId, { email: false }), "Couldn't update proposal")}>
                <CheckIcon /> Mark as sent (no email)
              </DropdownMenuItem>
            )}
            {status === "SENT" && (
              <>
                <DropdownMenuItem onClick={() => run(() => sendProposal(proposalId, { email: true }), "Couldn't send proposal")}>
                  <SendIcon /> Email again
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => run(() => setProposalOutcome(proposalId, "ACCEPTED"), "Couldn't update proposal")}>
                  <CheckIcon /> Mark accepted
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => run(() => setProposalOutcome(proposalId, "DECLINED"), "Couldn't update proposal")}>
                  <XIcon /> Mark declined
                </DropdownMenuItem>
              </>
            )}
            {status === "DRAFT" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2Icon /> Delete draft
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete draft {number}?</DialogTitle>
            <DialogDescription>The draft is removed. Its number won&rsquo;t be reused.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setConfirmDelete(false)
                run(() => deleteProposal(proposalId), "Couldn't delete proposal")
              }}
            >
              Delete draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { ProposalActions }
