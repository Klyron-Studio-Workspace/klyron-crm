import "server-only"

import { createHash, randomBytes } from "node:crypto"

/** URL-safe random token (256 bits by default). Give the raw value to the user; store only its hash. */
export function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url")
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

/** Readable temporary password for admin resets, e.g. "k7Qm-x2Rt-9vLp-Wd4n". */
export function generateTempPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(16)
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length])
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-")
}
