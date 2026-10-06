import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { NewPasswordForm } from "@/components/auth/new-password-form"
import { resetPassword } from "@/lib/actions/auth"

export const metadata: Metadata = { title: "Choose a new password" }

export default async function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  const { token } = await params
  return (
    <AuthShell title="New password." description="Choose a new password. All your devices will be signed out.">
      <NewPasswordForm action={resetPassword} hidden={{ token }} submitLabel="Update password" />
    </AuthShell>
  )
}
