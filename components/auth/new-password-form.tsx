"use client"

import { useActionState } from "react"

import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { Button } from "@/components/ui/button"
import type { FormState } from "@/lib/actions/state"
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy"

type NewPasswordFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  /** Hidden fields, e.g. the reset token. */
  hidden?: Record<string, string>
  /** Ask for the current password (signed-in change). */
  requireCurrent?: boolean
  submitLabel: string
}

function NewPasswordForm({ action, hidden, requireCurrent, submitLabel }: NewPasswordFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const errors = state?.fieldErrors

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state?.ok && state.message && <FormAlert tone="success">{state.message}</FormAlert>}
      {hidden && Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {requireCurrent && (
        <FormField
          label="Current password"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          errors={errors?.current}
        />
      )}
      <FormField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        errors={errors?.password}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short phrase works well.`}
      />
      <FormField
        label="Confirm new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        errors={errors?.confirm}
      />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  )
}

export { NewPasswordForm }
