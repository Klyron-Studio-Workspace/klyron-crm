import Image from "next/image"

import { cn } from "@/lib/utils"
import klyronMark from "./klyron-mark.png"

/**
 * Klyron origami "K" lettermark (brand asset: ./klyron-mark.png, 48x48).
 * The favicon is the same file at app/icon.png. For sharper rendering above
 * ~24px on high-DPI screens, replace both with a larger PNG or an SVG export.
 */
function KlyronMark({
  className,
  title = "Klyron Studio",
  decorative = false,
}: {
  className?: string
  title?: string
  /** Hide from assistive tech when the brand name is already present as text. */
  decorative?: boolean
}) {
  return (
    <Image
      src={klyronMark}
      alt={decorative ? "" : title}
      aria-hidden={decorative || undefined}
      priority
      className={cn("size-8 shrink-0 object-contain", className)}
    />
  )
}

function KlyronWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-heading text-[15px] leading-none font-semibold tracking-tight text-foreground",
        className
      )}
    >
      Klyron <span className="font-normal text-muted-foreground">Studio</span>
    </span>
  )
}

export { KlyronMark, KlyronWordmark }
