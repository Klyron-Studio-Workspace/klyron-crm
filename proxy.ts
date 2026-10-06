import { NextResponse, type NextRequest } from "next/server"

const SESSION_COOKIES = ["klyron_session", "__Host-klyron_session"]
// /i and /p are secret-link invoices and proposals for clients without an account.
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/i", "/p"]

/**
 * Optimistic gate only: sends visitors without a session cookie to /login.
 * Real validation (database session, role, permissions) happens in lib/auth/dal.ts
 * on every page and server action.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name))

  if (!isPublic && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return NextResponse.next()
}

export const config = {
  // API routes authenticate themselves (401, not a redirect). Excluding them also keeps
  // large uploads out of the proxy, which would buffer and cap request bodies at 10 MB.
  matcher: ["/((?!api/|_next/static|_next/image|icon.png|favicon.ico|robots.txt).*)"],
}
