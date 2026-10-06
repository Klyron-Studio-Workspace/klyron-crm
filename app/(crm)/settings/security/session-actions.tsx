"use client"

import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { revokeOtherSessions, revokeSession } from "@/lib/actions/auth"

function RevokeSessionButton({ sessionId, current }: { sessionId: string; current: boolean }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant={current ? "ghost" : "secondary"}
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => revokeSession(sessionId))}
    >
      {current ? "Sign out" : "Revoke"}
    </Button>
  )
}

function RevokeOthersButton() {
  const [pending, startTransition] = useTransition()
  return (
    <Button variant="destructive" size="sm" disabled={pending} onClick={() => startTransition(() => revokeOtherSessions())}>
      Sign out all other devices
    </Button>
  )
}

export { RevokeOthersButton, RevokeSessionButton }
