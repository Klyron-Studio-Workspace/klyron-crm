// Shared by the app and prisma/seed.ts, so no "server-only" or "@/" imports here.
import { hash, verify } from "@node-rs/argon2"

export { checkPasswordPolicy } from "./password-policy.ts"

// Argon2id with OWASP-recommended parameters (19 MiB, 2 passes, 1 lane).
const ARGON2_OPTIONS = {
  algorithm: 2, // Argon2id
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const

export function hashPassword(password: string) {
  return hash(password, ARGON2_OPTIONS)
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}
