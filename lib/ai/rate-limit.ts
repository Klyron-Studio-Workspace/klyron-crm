const recent = new Map<string, number[]>()

export function allowAiRequest(userId: string, limit = 6) {
  const now = Date.now()
  const calls = (recent.get(userId) ?? []).filter((at) => now - at < 60_000)
  if (calls.length >= limit) return false
  calls.push(now)
  recent.set(userId, calls)
  return true
}
