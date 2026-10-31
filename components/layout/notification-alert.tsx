"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { useRealtime } from "@/components/realtime/realtime-provider"
import { plainText } from "@/lib/chat/mentions"

/**
 * Module-level AudioContext — created once on the first user gesture so browsers
 * don't block it. SSE events fire without a gesture, so we resume() before playing.
 */
let audioCtx: AudioContext | null = null

function unlockAudio() {
  if (audioCtx) return
  try { audioCtx = new AudioContext() } catch { /* unsupported */ }
}

async function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    if (audioCtx.state === "suspended") await audioCtx.resume()

    const ctx = audioCtx
    const t = ctx.currentTime

    const schedule = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.3, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
      osc.start(start)
      osc.stop(start + dur)
    }

    schedule(880, t, 0.35)         // A5
    schedule(1108, t + 0.09, 0.28) // C#6
  } catch { /* audio blocked or unavailable */ }
}

function showPushNotification(title: string, body?: string | null, link?: string | null) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return
  // No shared tag: with one, Windows silently replaces the previous toast instead of popping a new one.
  const n = new Notification(title, { body: body ?? undefined, icon: "/icon.png" })
  n.onclick = () => {
    window.focus()
    if (link) window.location.assign(link)
    n.close()
  }
}

/**
 * Single instance in the CRM/portal layout (inside <RealtimeProvider>).
 * - Plays a two-tone "ding" on new mail or in-app notifications.
 * - Shows a browser push notification with sender/subject.
 * Renders nothing. Browsers only allow audio and the permission prompt after a user
 * gesture, so both happen on the first click or key press.
 */
function NotificationAlert({ context = "team", userId }: { context?: "team" | "client"; userId: string }) {
  const pathname = usePathname()

  React.useEffect(() => {
    function onFirstGesture() {
      unlockAudio()
      if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission()
    }
    document.addEventListener("click", onFirstGesture, { once: true })
    document.addEventListener("keydown", onFirstGesture, { once: true })
    return () => {
      document.removeEventListener("click", onFirstGesture)
      document.removeEventListener("keydown", onFirstGesture)
    }
  }, [])

  useRealtime((event) => {
    if (event.type === "mail.inbound") {
      void playNotificationSound()
      showPushNotification(
        `New email from ${event.fromName ?? "Unknown"}`,
        event.subject,
      )
    }
    // The server only sends a message to that chat's audience (its client + team), so no
    // extra filtering is needed here. Online users get no "chat.message" notification, so
    // the live message itself is what rings.
    if (event.type === "message") {
      const { message } = event
      if (message.authorId === userId || message.call) return // own message; calls ring via call.started
      const link = context === "client" ? "/portal/chat" : `/chat/${event.channelId}`
      if (document.visibilityState === "visible" && document.hasFocus() && pathname === link) return
      void playNotificationSound()
      const text = plainText(message.body)
      showPushNotification(
        `New message from ${message.authorName}`,
        text || (message.files.length ? "Sent a file" : null),
        link,
      )
    }
    if (event.type === "notification") {
      if (event.notification.type === "chat.mention") return // the message event already rang
      void playNotificationSound()
      showPushNotification(event.notification.title, event.notification.body, event.notification.link)
    }
  })

  return null
}

export { NotificationAlert }
