/** Short, human label for a user-agent string, e.g. "Chrome on Windows". */
export function describeUserAgent(ua: string | null) {
  if (!ua) return "Unknown device"
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : "Browser"
  const os =
    /Windows/.test(ua) ? "Windows"
    : /iPhone|iPad/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "Unknown OS"
  return `${browser} on ${os}`
}
