// Safe for client and server (no native modules). Also imported by prisma/seed.ts.

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

/** Returns an error message, or null when the password is acceptable. */
export function checkPasswordPolicy(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`
  if (password.length > PASSWORD_MAX_LENGTH)
    return `Use at most ${PASSWORD_MAX_LENGTH} characters.`
  return null
}
