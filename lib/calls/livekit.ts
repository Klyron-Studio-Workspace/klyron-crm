import "server-only"

import { AccessToken, RoomServiceClient, WebhookReceiver } from "livekit-server-sdk"

/**
 * Self-hosted LiveKit. LIVEKIT_URL is what browsers connect to (ws:// in dev,
 * wss:// in production); the server API uses the same host over http(s).
 */
export function livekitConfig() {
  const url = process.env.LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!url || !apiKey || !apiSecret) return null
  const httpUrl = process.env.LIVEKIT_HTTP_URL || url.replace(/^ws(s?):\/\//, "http$1://")
  return { url, httpUrl, apiKey, apiSecret }
}

export function isCallsConfigured() {
  return livekitConfig() !== null
}

/** Join token for one person in one room, valid long enough to join (LiveKit keeps them connected after). */
export async function createJoinToken(roomName: string, user: { id: string; name: string }, canPublish: boolean) {
  const config = livekitConfig()
  if (!config) throw new Error("Video calls aren't configured (LIVEKIT_* in .env).")
  const token = new AccessToken(config.apiKey, config.apiSecret, { identity: user.id, name: user.name, ttl: "10m" })
  token.addGrant({ room: roomName, roomJoin: true, canPublish, canPublishData: canPublish, canSubscribe: true })
  return { token: await token.toJwt(), url: config.url }
}

let roomService: RoomServiceClient | null = null
function rooms() {
  const config = livekitConfig()
  if (!config) return null
  roomService ??= new RoomServiceClient(config.httpUrl, config.apiKey, config.apiSecret)
  return roomService
}

/** Disconnects everyone. Missing rooms (already closed) are fine. */
export async function closeRoom(roomName: string) {
  try {
    await rooms()?.deleteRoom(roomName)
  } catch {
    // Room already gone, or LiveKit unreachable: the call is ended in the CRM either way.
  }
}

/** Participant count, or null when LiveKit can't be reached (so we don't end calls on a hiccup). */
export async function roomParticipantCount(roomName: string) {
  const service = rooms()
  if (!service) return null
  try {
    return (await service.listParticipants(roomName)).length
  } catch (error) {
    // A room that doesn't exist (yet / anymore) reports "not found".
    return /not.?found/i.test(error instanceof Error ? error.message : String(error)) ? 0 : null
  }
}

export function webhookReceiver() {
  const config = livekitConfig()
  return config ? new WebhookReceiver(config.apiKey, config.apiSecret) : null
}
