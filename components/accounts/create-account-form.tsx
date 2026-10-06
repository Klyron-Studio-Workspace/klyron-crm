"use client"

import * as React from "react"
import { useActionState } from "react"
import { EyeIcon, EyeOffIcon, WandSparklesIcon } from "lucide-react"

import { CopySecret } from "@/components/forms/copy-secret"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { Button } from "@/components/ui/button"
import { DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { FormState } from "@/lib/actions/state"
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy"
import { roleLabels } from "@/lib/auth/permissions"
import type { Role } from "@/lib/generated/prisma/enums"

/** Readable random password, e.g. "kT7m-Qx2r-9vLp-Wd4n" (generated in the browser). */
function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length])
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-")
}

type CreateAccountFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  /** Role picker for team accounts; omitted for client portal accounts. */
  roles?: Role[]
  hidden?: Record<string, string>
  submitLabel: string
}

/** Name, email, password (with generator) and "must change" flag. Shows the details once on success. */
function CreateAccountForm({ action: serverAction, roles, hidden, submitLabel }: CreateAccountFormProps) {
  const [state, action, pending] = useActionState(serverAction, undefined)
  // Kept in the browser only, so it can be shown for sharing without the server echoing it back.
  const [password, setPassword] = React.useState("")
  const [visible, setVisible] = React.useState(false)
  const items = (roles ?? []).map((role) => ({ value: role, label: roleLabels[role] }))
  const values = state?.values
  const errors = state?.fieldErrors

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert tone="success">{state.message} Share these sign-in details with them privately.</FormAlert>
        <div className="flex flex-col gap-2">
          <Label>Email</Label>
          <CopySecret value={values?.email ?? ""} label="Email" />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Password</Label>
          <CopySecret value={password} label="Password" />
          <p className="text-xs text-muted-foreground">
            {values?.mustChangePassword === "on"
              ? "They'll be asked to choose their own password the first time they sign in."
              : "This password stays until they change it in Settings → Security."}
          </p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button />}>Done</DialogClose>
        </DialogFooter>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {hidden && Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <div key={JSON.stringify(values ?? null)} className="flex flex-col gap-4">
        <FormField label="Full name" name="name" required autoComplete="off" defaultValue={values?.name} errors={errors?.name} />
        <FormField label="Email" name="email" type="email" required autoComplete="off" defaultValue={values?.email} errors={errors?.email} />
        {roles && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="member-role">Role</Label>
          <Select
            name="role"
            items={items}
            defaultValue={(values?.role as Role | undefined) ?? (roles.includes("MEMBER") ? "MEMBER" : roles[0])}
          >
            <SelectTrigger id="member-role" className="h-10! w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.role && <p className="text-xs text-primary-strong">{errors.role[0]}</p>}
        </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="member-password">Password</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="member-password"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={errors?.password ? true : undefined}
              aria-describedby="member-password-hint"
              className="h-10 pr-10 font-mono"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={visible ? "Hide password" : "Show password"}
              onClick={() => setVisible((v) => !v)}
              className="absolute top-1 right-1 text-muted-foreground"
            >
              {visible ? <EyeOffIcon /> : <EyeIcon />}
            </Button>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => {
              setPassword(generatePassword())
              setVisible(true)
            }}
          >
            <WandSparklesIcon data-icon="inline-start" />
            Generate
          </Button>
        </div>
        <p id="member-password-hint" className={errors?.password ? "text-xs text-primary-strong" : "text-xs text-muted-foreground"}>
          {errors?.password?.[0] ?? `At least ${PASSWORD_MIN_LENGTH} characters.`}
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border p-3">
        <input
          key={values?.mustChangePassword ?? "default"}
          type="checkbox"
          name="mustChangePassword"
          defaultChecked={values ? values.mustChangePassword === "on" : true}
          className="mt-0.5 size-4 accent-primary"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Ask them to choose their own password</span>
          <span className="text-sm text-muted-foreground">
            They sign in with this password once, then set a private one. Recommended.
          </span>
        </span>
      </label>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="secondary" />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

export { CreateAccountForm }
