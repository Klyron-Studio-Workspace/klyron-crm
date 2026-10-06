"use client"

import * as React from "react"
import { UserPlusIcon } from "lucide-react"

import { CreateAccountForm } from "@/components/accounts/create-account-form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createMember } from "@/lib/actions/team"
import type { Role } from "@/lib/generated/prisma/enums"

function AddMemberDialog({ roles }: { roles: Role[] }) {
  // Remount on each open so the previous member's details never reappear.
  const [openCount, setOpenCount] = React.useState(0)
  return (
    <Dialog onOpenChange={(open) => open && setOpenCount((n) => n + 1)}>
      <DialogTrigger render={<Button />}>
        <UserPlusIcon data-icon="inline-start" />
        Add member
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a team member</DialogTitle>
          <DialogDescription>Create their account. They sign in on the regular login page with these details.</DialogDescription>
        </DialogHeader>
        <CreateAccountForm key={openCount} action={createMember} roles={roles} submitLabel="Add member" />
      </DialogContent>
    </Dialog>
  )
}

export { AddMemberDialog }
