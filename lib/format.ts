/**
 * All dates render in the studio's time zone, on both server and client, so the
 * VPS clock (usually UTC) never shifts what people see and hydration stays stable.
 */
export const APP_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE || "Asia/Karachi"

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
})
const shortDateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: APP_TIME_ZONE })
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
})
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: APP_TIME_ZONE })
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE })
const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

export function formatDate(date: Date) {
  return dateFormat.format(date)
}

export function formatShortDate(date: Date) {
  return shortDateFormat.format(date)
}

export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date)
}

export function formatTime(date: Date) {
  return timeFormat.format(date)
}

/** "2026-10-06" in the app time zone. */
export function dayKey(date: Date) {
  return dayKeyFormat.format(date)
}

export function isSameDay(a: Date, b: Date) {
  return dayKey(a) === dayKey(b)
}

/** "just now", "5 minutes ago", "yesterday", then a date after a week. */
export function formatRelative(date: Date, now = Date.now()) {
  const seconds = Math.round((date.getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return "just now"
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), "minute")
  if (abs < 86400) return relativeFormat.format(Math.round(seconds / 3600), "hour")
  if (abs < 7 * 86400) return relativeFormat.format(Math.round(seconds / 86400), "day")
  return formatDate(date)
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""
  return (first + last).toUpperCase() || "?"
}

// ─── Calendar dates (deadlines stored as DATE, passed around as "YYYY-MM-DD") ──

const dateOnlyFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
const dateOnlyShortFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })

/** "2026-10-07" → Date at UTC midnight, for DATE columns. */
export function parseDateOnly(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`)
}

export function toDateOnly(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : null
}

export function formatDateOnly(ymd: string, options: { short?: boolean } = {}) {
  return (options.short ? dateOnlyShortFormat : dateOnlyFormat).format(parseDateOnly(ymd))
}

/** Compares a calendar date with "today" in the app time zone. */
export function dueState(ymd: string | null, now = new Date()): "overdue" | "today" | "upcoming" | null {
  if (!ymd) return null
  const today = dayKey(now)
  if (ymd < today) return "overdue"
  if (ymd === today) return "today"
  return "upcoming"
}
