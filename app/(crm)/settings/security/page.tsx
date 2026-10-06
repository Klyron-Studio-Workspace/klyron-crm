import type { Metadata } from "next"
import { MonitorSmartphoneIcon } from "lucide-react"

import { NewPasswordForm } from "@/components/auth/new-password-form"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { changePassword } from "@/lib/actions/auth"
import { requireTeamUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { formatRelative } from "@/lib/format"
import { describeUserAgent } from "@/lib/user-agent"
import { RevokeOthersButton, RevokeSessionButton } from "./session-actions"

export const metadata: Metadata = { title: "Security" }

export default async function SecurityPage() {
  const user = await requireTeamUser()
  const sessions = await db.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
  })
  // Current device first.
  sessions.sort((a, b) => Number(b.id === user.sessionId) - Number(a.id === user.sessionId))

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card className="self-start">
        <CardHeader className="border-b">
          <CardTitle className="text-base font-semibold">Change password</CardTitle>
          <CardDescription>Other devices are signed out when you change it.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewPasswordForm action={changePassword} requireCurrent submitLabel="Update password" />
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader className="border-b">
          <CardTitle className="text-base font-semibold">Active sessions</CardTitle>
          <CardDescription>Devices signed in to your account. Revoke anything you don&rsquo;t recognize.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y divide-border">
            {sessions.map((session) => {
              const current = session.id === user.sessionId
              return (
                <li key={session.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground">
                    <MonitorSmartphoneIcon aria-hidden className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {describeUserAgent(session.userAgent)}
                      {current && <Badge variant="brand" className="rounded-md">This device</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {session.ipAddress ?? "Unknown IP"} · Active {formatRelative(session.lastSeenAt)}
                    </div>
                  </div>
                  <RevokeSessionButton sessionId={session.id} current={current} />
                </li>
              )
            })}
          </ul>
          {sessions.length > 1 && (
            <div className="border-t border-border pt-4">
              <RevokeOthersButton />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
