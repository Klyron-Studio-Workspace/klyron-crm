import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { NewPasswordForm } from "@/components/auth/new-password-form"
import { changePassword } from "@/lib/actions/auth"
import { requireUser } from "@/lib/auth/dal"

export const metadata: Metadata = { title: "Change password" }

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true })
  return (
    <AuthShell
      title="Set your password."
      description={
        user.mustChangePassword
          ? "You signed in with a temporary password. Choose your own to continue."
          : "Choose a new password. Other devices will be signed out."
      }
    >
      <NewPasswordForm action={changePassword} requireCurrent submitLabel="Save password" />
    </AuthShell>
  )
}
