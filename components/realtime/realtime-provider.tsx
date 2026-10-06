"use client"

import * as React from "react"

import type { RealtimeEvent } from "@/lib/realtime/events"

type Listener = (event: RealtimeEvent) => void

const RealtimeContext = React.createContext<{ subscribe: (listener: Listener) => () => void } | null>(null)

/** One Server-Sent Events connection per tab, shared by every live component. Reconnects automatically. */
function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const listeners = React.useRef(new Set<Listener>())

  React.useEffect(() => {
    const source = new EventSource("/api/events")
    source.onmessage = (message) => {
      let event: RealtimeEvent
      try {
        event = JSON.parse(message.data)
      } catch {
        return
      }
      for (const listener of listeners.current) listener(event)
    }
    return () => source.close()
  }, [])

  const value = React.useMemo(
    () => ({
      subscribe(listener: Listener) {
        listeners.current.add(listener)
        return () => {
          listeners.current.delete(listener)
        }
      },
    }),
    []
  )
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

/** Calls `handler` for every live event. The latest handler is always used. */
function useRealtime(handler: Listener) {
  const context = React.useContext(RealtimeContext)
  const ref = React.useRef(handler)
  React.useLayoutEffect(() => {
    ref.current = handler
  })
  React.useEffect(() => {
    if (!context) return
    return context.subscribe((event) => ref.current(event))
  }, [context])
}

export { RealtimeProvider, useRealtime }
