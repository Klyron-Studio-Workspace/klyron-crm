import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthShell } from "@/components/auth/auth-shell"
import { getCurrentUser } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser()
  if (user) redirect(isTeamRole(user.role) ? "/" : "/portal")

  const { reset } = await searchParams
  return (
    <AuthShell title="Welcome back." description="Sign in to the Klyron Studio CRM.">
      <LoginForm notice={reset ? "Password updated. Sign in with your new password." : undefined} />
    </AuthShell>
  )
}
