"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { VideoIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { startCall } from "@/lib/actions/calls"

/** Starts a video call in this conversation, or joins the one already running. */
function StartCallButton({ channelId, className }: { channelId: string; className?: string }) {
  const router = useRouter()
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()
  return (
    <Button
      size="sm"
      variant="secondary"
      className={className}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startCall(channelId)
          if (result.ok) router.push(result.href)
          else toast.add({ type: "error", title: "Couldn't start the call", description: result.error })
        })
      }
    >
      <VideoIcon data-icon="inline-start" />
      {pending ? "Starting…" : "Call"}
    </Button>
  )
}

export { StartCallButton }
