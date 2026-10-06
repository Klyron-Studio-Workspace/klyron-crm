import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "./forgot-password-form"

export const metadata: Metadata = { title: "Reset password" }

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset password."
      description="Team members get a reset link by email. Clients: ask your Klyron contact to reset your password."
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
