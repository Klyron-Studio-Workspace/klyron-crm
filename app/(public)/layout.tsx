import type { Metadata } from "next"

// Secret-link documents: keep them out of search engines and don't leak the URL onward.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default function PublicDocumentLayout({ children }: LayoutProps<"/">) {
  return <div className="light min-h-svh bg-muted/40 print:bg-white">{children}</div>
}
