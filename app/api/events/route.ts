import { getCurrentUser } from "@/lib/auth/dal"
import { subscribe } from "@/lib/realtime/bus"
import type { RealtimeEvent } from "@/lib/realtime/events"

const HEARTBEAT_MS = 25_000

/**
 * Server-Sent Events stream for the signed-in user: new messages, typing,
 * read state and notifications. Behind Nginx, buffering must be off for this
 * path (the X-Accel-Buffering header below does that per response).
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const encoder = new TextEncoder()
  let cleanup = () => {}

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          cleanup()
        }
      }
      send(`retry: 3000\n\n`)
      const unsubscribe = subscribe(user.id, (event: RealtimeEvent) => send(`data: ${JSON.stringify(event)}\n\n`))
      const heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS)
      cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
        cleanup = () => {}
      }
      request.signal.addEventListener("abort", () => {
        cleanup()
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
