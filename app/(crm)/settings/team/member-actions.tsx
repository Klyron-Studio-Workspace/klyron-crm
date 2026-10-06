"use client"

import * as React from "react"
import {
  BanIcon,
  CircleCheckIcon,
  KeyRoundIcon,
  MoreHorizontalIcon,
  ShieldIcon,
  Trash2Icon,
} from "lucide-react"

import { CopySecret } from "@/components/forms/copy-secret"
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
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/toast"
import { adminResetPassword, changeRole, removeMember, setStatus } from "@/lib/actions/team"
import { roleLabels } from "@/lib/auth/permissions"
import type { Role, UserStatus } from "@/lib/generated/prisma/enums"

type Member = { id: string; name: string; role: Role; status: UserStatus }
type Result = { ok: true; message?: string; secret?: string } | { ok: false; error: string }
type Confirm = "remove" | "reset" | null

function MemberActions({ member, roles }: { member: Member; roles: Role[] }) {
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()
  const [confirm, setConfirm] = React.useState<Confirm>(null)
  const [secret, setSecret] = React.useState<{ message: string; value: string } | null>(null)

  function run(task: () => Promise<Result>, after?: (result: Extract<Result, { ok: true }>) => void) {
    startTransition(async () => {
      const result = await task()
      if (!result.ok) {
        toast.add({ type: "error", title: "Couldn't update member", description: result.error })
        return
      }
      if (after) after(result)
      else if (result.message) toast.add({ type: "success", title: result.message })
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${member.name}`}
              className="text-muted-foreground"
              disabled={pending}
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{member.name}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ShieldIcon /> Change role
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={member.role}
                onValueChange={(role: Role) => {
                  if (role !== member.role) run(() => changeRole(member.id, role))
                }}
              >
                {roles.map((role) => (
                  <DropdownMenuRadioItem key={role} value={role}>
                    {roleLabels[role]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => setConfirm("reset")}>
            <KeyRoundIcon /> Reset password
          </DropdownMenuItem>
          {member.status === "ACTIVE" ? (
            <DropdownMenuItem onClick={() => run(() => setStatus(member.id, "DISABLED"))}>
              <BanIcon /> Disable sign-in
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => run(() => setStatus(member.id, "ACTIVE"))}>
              <CircleCheckIcon /> Enable sign-in
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirm("remove")}>
            <Trash2Icon /> Remove from team
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "remove" ? `Remove ${member.name}?` : `Reset ${member.name}'s password?`}
            </DialogTitle>
            <DialogDescription>
              {confirm === "remove"
                ? "Their account is deleted and they are signed out everywhere. Their past activity stays in the audit log."
                : "They will be signed out everywhere and must choose a new password with the temporary one you share."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
            <Button
              variant={confirm === "remove" ? "destructive" : "default"}
              disabled={pending}
              onClick={() => {
                const action = confirm
                setConfirm(null)
                if (action === "remove") run(() => removeMember(member.id))
                if (action === "reset") {
                  run(
                    () => adminResetPassword(member.id),
                    (result) => result.secret && setSecret({ message: result.message ?? "", value: result.secret })
                  )
                }
              }}
            >
              {confirm === "remove" ? "Remove member" : "Reset password"}
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
    </>
  )
}

export { MemberActions }
