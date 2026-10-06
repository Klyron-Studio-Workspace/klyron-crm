"use client"

import { useActionState } from "react"
import Link from "next/link"

import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { Button } from "@/components/ui/button"
import { requestPasswordReset } from "@/lib/actions/auth"

function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined)

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state?.message && <FormAlert tone="success">{state.message}</FormAlert>}
      <FormField
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={state?.fieldErrors?.email}
      />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <Link href="/login" className="link self-center text-sm">
        Back to sign in
      </Link>
    </form>
  )
}

export { ForgotPasswordForm }
