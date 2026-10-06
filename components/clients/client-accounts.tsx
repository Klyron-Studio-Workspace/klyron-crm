"use client"

import * as React from "react"
import { BanIcon, CircleCheckIcon, KeyRoundIcon, MoreHorizontalIcon, Trash2Icon, UserPlusIcon } from "lucide-react"

import { CreateAccountForm } from "@/components/accounts/create-account-form"
import { CopySecret } from "@/components/forms/copy-secret"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/toast"
import { createClientAccount, removeClientAccount, resetClientPassword, setClientAccountStatus } from "@/lib/actions/clients"
import { formatRelative } from "@/lib/format"

export type ClientAccountDTO = {
  id: string
  name: string
  email: string
  active: boolean
  lastLoginAt: string | null
}

type Result = { ok: true; message?: string; secret?: string } | { ok: false; error: string }

function AccountRow({ account, canManage }: { account: ClientAccountDTO; canManage: boolean }) {
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()
  const [confirmRemove, setConfirmRemove] = React.useState(false)
  const [secret, setSecret] = React.useState<{ message: string; value: string } | null>(null)

  function run(task: () => Promise<Result>) {
    startTransition(async () => {
      const result = await task()
      if (!result.ok) toast.add({ type: "error", title: "Couldn't update account", description: result.error })
      else if (result.secret) setSecret({ message: result.message ?? "", value: result.secret })
      else if (result.message) toast.add({ type: "success", title: result.message })
    })
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {account.name}
          {!account.active && <Badge variant="neutral" className="rounded-md text-muted-foreground">Disabled</Badge>}
        </p>
        <p suppressHydrationWarning className="truncate text-xs text-muted-foreground">
          {account.email} · {account.lastLoginAt ? `Last sign-in ${formatRelative(new Date(account.lastLoginAt))}` : "Never signed in"}
        </p>
      </div>
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${account.name}`} className="text-muted-foreground" disabled={pending} />}
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => run(() => resetClientPassword(account.id))}>
              <KeyRoundIcon /> Reset password
            </DropdownMenuItem>
            {account.active ? (
              <DropdownMenuItem onClick={() => run(() => setClientAccountStatus(account.id, false))}>
                <BanIcon /> Disable sign-in
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => run(() => setClientAccountStatus(account.id, true))}>
                <CircleCheckIcon /> Enable sign-in
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmRemove(true)}>
              <Trash2Icon /> Remove access
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {account.name}&rsquo;s portal access?</DialogTitle>
            <DialogDescription>Their login is deleted and they&rsquo;re signed out everywhere. The client record is unaffected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmRemove(false)
                run(() => removeClientAccount(account.id))
              }}
            >
              Remove access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={secret !== null} onOpenChange={(open) => !open && setSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>{secret?.message}</DialogDescription>
          </DialogHeader>
          {secret && <CopySecret value={secret.value} label="Temporary password" />}
          <DialogFooter>
            <DialogClose render={<Button />}>Done</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}

function ClientAccounts({ clientId, clientName, accounts, canManage }: { clientId: string; clientName: string; accounts: ClientAccountDTO[]; canManage: boolean }) {
  const [openCount, setOpenCount] = React.useState(0)
  return (
    <div className="flex flex-col gap-3">
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No portal access yet. Give the client a login to follow their projects.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {accounts.map((a) => (
            <AccountRow key={a.id} account={a} canManage={canManage} />
          ))}
        </ul>
      )}
      {canManage && (
        <Dialog onOpenChange={(open) => open && setOpenCount((n) => n + 1)}>
          <DialogTrigger render={<Button variant="secondary" size="sm" className="self-start" />}>
            <UserPlusIcon data-icon="inline-start" />
            Give portal access
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Portal access for {clientName}</DialogTitle>
              <DialogDescription>
                They sign in on the regular login page and only see {clientName}&rsquo;s projects and milestones.
              </DialogDescription>
            </DialogHeader>
            <CreateAccountForm key={openCount} action={createClientAccount} hidden={{ clientId }} submitLabel="Create login" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export { ClientAccounts }
