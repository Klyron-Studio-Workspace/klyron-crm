import type { z } from "zod"

/** Shape returned by form server actions and consumed with useActionState. */
export type FormState = {
  ok?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  /** One-time values to show the admin (e.g. a temporary password). */
  secret?: string
  /** Submitted values echoed back, because React resets uncontrolled forms after an action. Never passwords. */
  values?: Record<string, string>
} | undefined

/** Non-secret text fields from a submission, for echoing back into the form. */
export function echo(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")]))
}

export function fieldErrorsFrom(error: z.ZodError, values?: Record<string, string>): FormState {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form")
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  return { fieldErrors, values }
}
