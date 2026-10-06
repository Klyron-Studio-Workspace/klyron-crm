import { APP_TIME_ZONE } from "@/lib/format"

/** Offset of the app time zone from UTC at a given instant, in minutes. */
function zoneOffsetMinutes(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return Math.round((asUtc - at.getTime()) / 60000)
}

/** Calendar date (y/m/d) of an instant in the app time zone. */
function zonedDate(at: Date) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(at).split("-").map(Number)
  return { y, m, d }
}

/** The instant a wall-clock time occurs in the app time zone. */
function fromZoned(y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min, s, ms))
  return new Date(guess.getTime() - zoneOffsetMinutes(guess) * 60000)
}

export function endOfTodayInZone(now = new Date()) {
  const { y, m, d } = zonedDate(now)
  return fromZoned(y, m, d, 23, 59, 59, 999)
}

export function startOfMonthInZone(now = new Date()) {
  const { y, m } = zonedDate(now)
  return fromZoned(y, m, 1)
}
