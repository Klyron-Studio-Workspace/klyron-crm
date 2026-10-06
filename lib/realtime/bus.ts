import "server-only"

import { EventEmitter } from "node:events"

import type { RealtimeEvent } from "@/lib/realtime/events"

/**
 * In-process pub/sub for live updates (Server-Sent Events).
 * Lives on globalThis so route handlers, server actions and the scheduler share
 * one instance. This assumes a single app process (PM2 fork mode); running
 * several instances would need a shared broker such as Redis.
 */
type Bus = { emitter: EventEmitter; connections: Map<string, number> }

const globalForBus = globalThis as unknown as { realtimeBus?: Bus }

function bus(): Bus {
  if (!globalForBus.realtimeBus) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(0)
    globalForBus.realtimeBus = { emitter, connections: new Map() }
  }
  return globalForBus.realtimeBus
}

export function publish(userIds: Iterable<string>, event: RealtimeEvent) {
  const { emitter } = bus()
  for (const userId of new Set(userIds)) emitter.emit(`user:${userId}`, event)
}

/** Registers an SSE connection. Returns an unsubscribe function. */
export function subscribe(userId: string, listener: (event: RealtimeEvent) => void) {
  const { emitter, connections } = bus()
  emitter.on(`user:${userId}`, listener)
  connections.set(userId, (connections.get(userId) ?? 0) + 1)
  return () => {
    emitter.off(`user:${userId}`, listener)
    const remaining = (connections.get(userId) ?? 1) - 1
    if (remaining <= 0) connections.delete(userId)
    else connections.set(userId, remaining)
  }
}

/** True while the user has the app open in at least one tab. */
export function isOnline(userId: string) {
  return (bus().connections.get(userId) ?? 0) > 0
}
