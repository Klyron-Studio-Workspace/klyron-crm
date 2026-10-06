import "server-only"

import { headers } from "next/headers"

export type RequestInfo = {
  ipAddress: string | null
  userAgent: string | null
}

/**
 * Client IP and user agent. Behind Nginx on the VPS, X-Forwarded-For / X-Real-IP
 * are set by the proxy; make sure Nginx overwrites (not appends to) them.
 */
export async function getRequestInfo(): Promise<RequestInfo> {
  const h = await headers()
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim()
  const ipAddress = (forwarded || h.get("x-real-ip") || null)?.slice(0, 45) ?? null
  const userAgent = h.get("user-agent")?.slice(0, 512) ?? null
  return { ipAddress, userAgent }
}

export function appUrl(path: string) {
  const base = process.env.APP_URL ?? "http://localhost:3000"
  return new URL(path, base).toString()
}
