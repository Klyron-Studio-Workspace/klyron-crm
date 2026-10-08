"use client"

import * as React from "react"
import { CheckIcon, CopyIcon, KeyRoundIcon } from "lucide-react"

import { CopySecret } from "@/components/forms/copy-secret"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import { generateMcpToken, revokeMcpToken } from "@/lib/actions/settings"
import { formatDateTime } from "@/lib/format"

function McpSettings({ endpoint, configured, createdAt }: { endpoint: string; configured: boolean; createdAt: string | null }) {
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()
  const [token, setToken] = React.useState<string | null>(null)
  const active = configured || Boolean(token)
  const assistants = ["ChatGPT", "Claude", "Codex", "Gemini"]

  function generate() {
    startTransition(async () => {
      const result = await generateMcpToken()
      if (!result.ok) toast.add({ type: "error", title: "Couldn't generate token", description: result.error })
      else setToken(result.token)
    })
  }

  function revoke() {
    startTransition(async () => {
      const result = await revokeMcpToken()
      if (!result.ok) toast.add({ type: "error", title: "Couldn't revoke token", description: result.error })
      else {
        setToken(null)
        toast.add({ type: "success", title: "MCP access revoked" })
      }
    })
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
    <Card className="max-w-2xl">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base font-semibold"><KeyRoundIcon aria-hidden className="size-4 text-primary" />MCP access</CardTitle>
        <CardDescription>Connect trusted AI tools to this CRM. The token grants access to every MCP tool.</CardDescription>
      </CardHeader>
      <CardContent className="gap-5">
        <div className="text-sm">
          <p className="font-medium">Endpoint</p>
          <code className="mt-1 block rounded-md bg-surface px-3 py-2 text-xs select-all">{endpoint}</code>
        </div>
        {token && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Copy this token now—it won&rsquo;t be shown again.</p>
            <CopySecret value={token} label="MCP bearer token" />
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {token ? "The previous token stopped working immediately." : active ? `Active token created ${createdAt ? formatDateTime(new Date(createdAt)) : "previously"}.` : "MCP access is currently off."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={generate}>{pending ? "Working…" : active ? "Rotate token" : "Generate token"}</Button>
          {active && <Button variant="destructive" disabled={pending} onClick={revoke}>Revoke access</Button>}
        </div>
      </CardContent>
    </Card>
    {active && (
      <Card className="max-w-2xl">
        <CardHeader className="border-b">
          <CardTitle className="text-base font-semibold">Setup prompts</CardTitle>
          <CardDescription>Copy a prompt into the assistant you want to connect.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          {assistants.map((assistant) => (
            <SetupPrompt key={assistant} assistant={assistant} endpoint={endpoint} token={token ?? "<YOUR_MCP_TOKEN>"} />
          ))}
          {!token && <p className="text-xs text-muted-foreground">Replace &lt;YOUR_MCP_TOKEN&gt; with the token you saved, or rotate the token to generate a new one.</p>}
        </CardContent>
      </Card>
    )}
    </div>
  )
}

function SetupPrompt({ assistant, endpoint, token }: { assistant: string; endpoint: string; token: string }) {
  const [copied, setCopied] = React.useState(false)
  const prompt = `Help me connect this remote MCP server to ${assistant} for my user account.\n\nServer URL: ${endpoint}\nAuthentication: Bearer token\nToken: ${token}\n\nUse ${assistant}'s current supported method for adding a remote HTTP MCP server. Keep the token secret, do not paste it into chat messages after setup, and verify the connection by calling the read-only crm_overview tool. Ask me to take over for any account sign-in or confirmation step.`

  async function copy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{assistant}</p>
        <p className="text-xs text-muted-foreground">Remote HTTP MCP with bearer authentication</p>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={copy}>
        {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
        {copied ? "Copied" : "Copy prompt"}
      </Button>
    </div>
  )
}

export { McpSettings }
