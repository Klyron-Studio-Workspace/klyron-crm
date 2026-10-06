"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Shows a one-time value (sign-in details, temporary password) with a copy button. */
function CopySecret({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the value is still selectable.
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-1.5 pl-3">
      <code aria-label={label} className="min-w-0 flex-1 truncate font-mono text-xs select-all">
        {value}
      </code>
      <Button type="button" size="sm" variant="secondary" onClick={copy}>
        {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  )
}

export { CopySecret }
