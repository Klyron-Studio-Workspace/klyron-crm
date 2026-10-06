"use client"

import { useActionState } from "react"

import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateOrgSettings } from "@/lib/actions/settings"

const currencies = [
  { value: "USD", label: "US Dollar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "GBP", label: "British Pound (GBP)" },
  { value: "PKR", label: "Pakistani Rupee (PKR)" },
  { value: "AED", label: "UAE Dirham (AED)" },
]

export type OrgSettingsValues = {
  name: string
  website: string | null
  billingEmail: string | null
  defaultCurrency: string
  membersSeeAssignedOnly: boolean
}

function OrgSettingsForm({ values, canEdit }: { values: OrgSettingsValues; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateOrgSettings, undefined)
  const errors = state?.fieldErrors
  const echoed = state?.values
  const v = echoed
    ? {
        name: echoed.name,
        website: echoed.website,
        billingEmail: echoed.billingEmail,
        defaultCurrency: echoed.defaultCurrency,
        membersSeeAssignedOnly: echoed.membersSeeAssignedOnly === "on",
      }
    : values

  return (
    <form action={action} noValidate>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base font-semibold">Studio profile</CardTitle>
          <CardDescription>Shown on proposals, invoices and client emails.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
          {state?.ok && <FormAlert tone="success">{state.message}</FormAlert>}
          {/* Remount after a failed save so fields show the echoed values (React resets forms after actions). */}
          <fieldset key={JSON.stringify(echoed ?? null)} disabled={!canEdit} className="grid gap-5 sm:grid-cols-2">
            <FormField label="Studio name" name="name" defaultValue={v.name} required errors={errors?.name} />
            <FormField
              label="Website"
              name="website"
              type="url"
              placeholder="https://www.klyronstudio.com"
              defaultValue={v.website ?? ""}
              errors={errors?.website}
            />
            <FormField
              label="Billing email"
              name="billingEmail"
              type="email"
              placeholder="billing@klyronstudio.com"
              defaultValue={v.billingEmail ?? ""}
              errors={errors?.billingEmail}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-currency">Default currency</Label>
              <Select key={v.defaultCurrency} name="defaultCurrency" items={currencies} defaultValue={v.defaultCurrency}>
                <SelectTrigger id="org-currency" className="h-10! w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-border p-4 sm:col-span-2">
              <input
                type="checkbox"
                name="membersSeeAssignedOnly"
                key={String(v.membersSeeAssignedOnly)}
                defaultChecked={v.membersSeeAssignedOnly}
                className="mt-0.5 size-4 accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Members see only assigned work</span>
                <span className="text-sm text-muted-foreground">
                  When on, Members only see leads and projects they are assigned to. Owners and Admins always see everything.
                </span>
              </span>
            </label>
          </fieldset>
        </CardContent>
        {canEdit && (
          <CardFooter className="justify-end border-t">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </form>
  )
}

export { OrgSettingsForm }
