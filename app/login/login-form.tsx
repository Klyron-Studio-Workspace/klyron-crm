"use client"

import { useActionState } from "react"
import Link from "next/link"

import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { Button } from "@/components/ui/button"
import { login } from "@/lib/actions/auth"

function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state?.error ? (
        <FormAlert tone="error">{state.error}</FormAlert>
      ) : notice ? (
        <FormAlert tone="success">{notice}</FormAlert>
      ) : null}
      <FormField
        key={state?.values?.email}
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@klyronstudio.com"
        required
        defaultValue={state?.values?.email}
        errors={state?.fieldErrors?.email}
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={state?.fieldErrors?.password}
        labelAside={
          <Link href="/forgot-password" className="link text-xs">
            Forgot password?
          </Link>
        }
      />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}

export { LoginForm }
