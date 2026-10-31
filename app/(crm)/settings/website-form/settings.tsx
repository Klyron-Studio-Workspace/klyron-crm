"use client"

import * as React from "react"
import { GlobeIcon } from "lucide-react"

import { CopySecret } from "@/components/forms/copy-secret"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import { disableLeadForm, rotateLeadFormKey } from "@/lib/actions/settings"

function snippet(endpoint: string, key: string) {
  return `<form action="${endpoint}" method="POST">
  <input type="hidden" name="key" value="${key}">
  <!-- Optional: where to send people after submitting (must be this same site) -->
  <input type="hidden" name="_next" value="https://klyronstudio.com/thanks">
  <!-- Spam trap: keep this hidden and empty -->
  <input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off">

  <input name="name" placeholder="Your name" required>
  <input name="email" type="email" placeholder="Email" required>
  <input name="company" placeholder="Company">
  <input name="phone" placeholder="Phone">
  <textarea name="message" placeholder="Tell us about your project"></textarea>
  <button type="submit">Send</button>
</form>`
}

function WebsiteFormSettings({ endpoint, formKey }: { endpoint: string; formKey: string | null }) {
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) toast.add({ type: "error", title: "Couldn't update the form", description: result.error })
      else toast.add({ type: "success", title: success })
    })
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <GlobeIcon aria-hidden className="size-4 text-primary" />
          Website contact form
        </CardTitle>
        <CardDescription>
          When someone fills in the contact form on your website, they appear as a new lead in the first pipeline
          stage, and Owners and Admins get notified.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-5">
        {formKey ? (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Paste this form into your website</p>
              <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed">
                {snippet(endpoint, formKey)}
              </pre>
              <CopySecret value={snippet(endpoint, formKey)} label="Website form HTML" />
            </div>
            <p className="text-sm text-muted-foreground">
              Style the fields however you like; only the field names matter. Getting spam? Make a new key and update
              your website.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">The website form is off.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => run(rotateLeadFormKey, formKey ? "New key created" : "Website form turned on")}>
            {formKey ? "Make a new key" : "Turn on website form"}
          </Button>
          {formKey && (
            <Button variant="destructive" disabled={pending} onClick={() => run(disableLeadForm, "Website form turned off")}>
              Turn off
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export { WebsiteFormSettings }
