"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ComposeDialog } from "@/components/mail/compose-dialog"

export function ComposeTrigger() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const open = searchParams.get("compose") === "1"
  const defaultTo = searchParams.get("to") ?? ""

  if (!open) return null

  function close() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("compose")
    params.delete("to")
    router.replace(`/mail?${params.toString()}`)
  }

  return <ComposeDialog defaultTo={defaultTo} onClose={close} />
}
