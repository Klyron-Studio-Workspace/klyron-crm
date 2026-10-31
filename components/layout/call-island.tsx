"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PhoneIcon, PhoneOffIcon } from "lucide-react"

import { useRealtime } from "@/components/realtime/realtime-provider"
import type { NotificationDTO } from "@/lib/realtime/events"
import { cn } from "@/lib/utils"

const AUTO_DISMISS_MS = 30_000

type Phase = "hidden" | "pill" | "expanded"

/**
 * Apple Dynamic Island–style incoming call banner.
 * Appears at top-center when a call.started notification arrives via SSE,
 * morphs from a small pill → expanded card with springy animation.
 * Auto-dismisses after 30 s if ignored.
 */
function CallIsland() {
  const router = useRouter()
  const [call, setCall] = React.useState<NotificationDTO | null>(null)
  const [phase, setPhase] = React.useState<Phase>("hidden")
  const dismissTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearDismissTimer() {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current)
      dismissTimer.current = null
    }
  }

  function dismiss() {
    clearDismissTimer()
    setPhase("pill")
    setTimeout(() => {
      setPhase("hidden")
      setCall(null)
    }, 400)
  }

  function join() {
    if (!call?.link) return
    const href = call.link
    dismiss()
    // Small delay so the collapse animation starts before navigation
    setTimeout(() => router.push(href), 100)
  }

  useRealtime((event) => {
    console.log("[CallIsland] SSE event:", event.type, event)
    if (event.type !== "notification" || event.notification.type !== "call.started") return
    showIsland(event.notification)
  })

  function showIsland(notification: NotificationDTO) {
    clearDismissTimer()
    setCall(notification)
    setPhase("pill")
    setTimeout(() => setPhase("expanded"), 50)
    dismissTimer.current = setTimeout(dismiss, AUTO_DISMISS_MS)
  }

  // Dev helper — open browser console and run: window.__testCallIsland()
  React.useEffect(() => {
    ;(window as Window & { __testCallIsland?: () => void }).__testCallIsland = () =>
      showIsland({
        id: "test",
        type: "call.started",
        title: "Kaarim started a call",
        body: "Call with Acme Corp",
        link: "/calls/test",
        readAt: null,
        createdAt: new Date().toISOString(),
      })
    return () => {
      delete (window as Window & { __testCallIsland?: () => void }).__testCallIsland
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => () => clearDismissTimer(), [])

  if (phase === "hidden") return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[9999] flex justify-center">
      <div
        className={cn(
          // Base: always dark pill
          "pointer-events-auto overflow-hidden bg-[#1c1c1e] text-white shadow-2xl",
          "transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          // Pill vs expanded sizes
          phase === "expanded"
            ? "w-80 rounded-[28px] px-5 py-4 opacity-100"
            : "h-8 w-28 rounded-full opacity-90",
        )}
      >
        {phase === "expanded" && call && (
          <div
            className={cn(
              "flex flex-col gap-3",
              "animate-in fade-in-0 zoom-in-95 duration-300",
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              {/* Pulsing ring icon */}
              <div className="relative flex-shrink-0">
                <span className="absolute inset-0 rounded-full bg-green-500/40 animate-ping" />
                <span className="relative flex size-9 items-center justify-center rounded-full bg-green-500/20">
                  <PhoneIcon className="size-4 text-green-400" />
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-white">
                  {call.title}
                </p>
                {call.body && (
                  <p className="truncate text-[11px] leading-tight text-white/50">
                    {call.body}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={dismiss}
                className="flex items-center justify-center gap-1.5 rounded-full bg-white/10 py-2.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/20 active:scale-95"
              >
                <PhoneOffIcon className="size-3.5" />
                Dismiss
              </button>
              <button
                type="button"
                onClick={join}
                className="flex items-center justify-center gap-1.5 rounded-full bg-green-500 py-2.5 text-xs font-medium text-white transition-colors hover:bg-green-400 active:scale-95"
              >
                <PhoneIcon className="size-3.5" />
                Join call
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export { CallIsland }
