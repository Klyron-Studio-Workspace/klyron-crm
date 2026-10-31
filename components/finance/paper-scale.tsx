"use client"

import * as React from "react"

/**
 * Keeps a document at its fixed desktop layout and zooms the whole thing down to
 * fit narrow screens, like a PDF viewer, instead of reflowing it. Never zooms up.
 * Printing ignores the zoom and lets the paper fill the page.
 */
function PaperScale({ children }: { children: React.ReactNode }) {
  const outer = React.useRef<HTMLDivElement>(null)
  const inner = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const box = outer.current
    const paper = inner.current
    if (!box || !paper) return
    const fit = () => {
      paper.style.zoom = String(Math.min(1, box.clientWidth / paper.offsetWidth))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={outer} className="w-full overflow-hidden print:overflow-visible">
      {/* 50rem: in rem so the paper keeps its proportions when the root font size changes on phones */}
      <div ref={inner} className="mx-auto w-[50rem] print:w-auto print:[zoom:1]!">
        {children}
      </div>
    </div>
  )
}

export { PaperScale }
