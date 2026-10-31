"use client"

import * as React from "react"
import { CheckIcon, PencilIcon, Trash2Icon, TypeIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { saveSignature } from "@/lib/actions/finance"

// ── Draw mode ────────────────────────────────────────────────────────────────

type Point = { x: number; y: number }
type Stroke = Point[]

const W = 480
const H = 160

function strokesToSvg(strokes: Stroke[]): string {
  const paths = strokes
    .filter((s) => s.length > 1)
    .map((s) => {
      const d = s.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
      return `<path d="${d}" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
    })
    .join("")
  // No width/height — let CSS size it; viewBox provides the aspect ratio.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${paths}</svg>`
}

function getPos(e: React.MouseEvent | React.TouchEvent, rect: DOMRect): Point {
  if ("touches" in e) {
    const t = e.touches[0]
    return { x: t.clientX - rect.left, y: t.clientY - rect.top }
  }
  return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
}

// ── Type mode ────────────────────────────────────────────────────────────────

const FONTS: { label: string; family: string; weight: string; cssVar: string; size: number }[] = [
  { label: "Classic",  family: "Dancing Script", weight: "700", cssVar: "var(--font-dancing-script)", size: 64 },
  { label: "Elegant",  family: "Great Vibes",    weight: "400", cssVar: "var(--font-great-vibes)",    size: 68 },
  { label: "Bold",     family: "Pacifico",        weight: "400", cssVar: "var(--font-pacifico)",       size: 52 },
]

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function textToSvg(text: string, font: (typeof FONTS)[number]): string {
  // textLength + spacingAndGlyphs stretches the text to always fit the viewBox width,
  // so long names never overflow regardless of font or character count.
  const pad = 16
  const vbW = W
  const vbH = font.size + 36  // cap room for ascenders + descenders
  const tl = vbW - pad * 2    // usable text length
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}">`,
    `<text x="${pad}" y="${font.size + 4}" `,
    `font-family="'${font.family}', cursive" `,
    `font-size="${font.size}" font-weight="${font.weight}" `,
    `textLength="${tl}" lengthAdjust="spacingAndGlyphs" `,
    `fill="currentColor">${xmlEscape(text)}</text>`,
    `</svg>`,
  ].join("")
}

// ── Shared saved view ────────────────────────────────────────────────────────

function SavedView({ svg, onRedraw, onClear, pending }: { svg: string; onRedraw: () => void; onClear: () => void; pending: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-lg border border-border bg-background p-4 text-foreground [&_svg]:h-auto [&_svg]:w-full"
        style={{ maxWidth: W / 2 }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onRedraw}>
          <PencilIcon data-icon="inline-start" />
          Change
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={onClear} className="text-muted-foreground hover:text-primary-strong">
          <Trash2Icon data-icon="inline-start" />
          Remove
        </Button>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function SignaturePad({ existing }: { existing: string | null }) {
  const [saved, setSaved] = React.useState(existing)
  const [editing, setEditing] = React.useState(!existing)
  const [tab, setTab] = React.useState<"draw" | "type">("draw")
  const [pending, setPending] = React.useState(false)
  const toast = useToast()

  async function handleSave(svg: string) {
    setPending(true)
    const result = await saveSignature(svg)
    setPending(false)
    if (result.ok) {
      setSaved(svg)
      setEditing(false)
      toast.add({ type: "success", title: "Signature saved." })
    } else {
      toast.add({ type: "error", title: "Couldn't save", description: result.error })
    }
  }

  async function handleClear() {
    setPending(true)
    const result = await saveSignature(null)
    setPending(false)
    if (result.ok) {
      setSaved(null)
      setEditing(true)
      toast.add({ type: "success", title: "Signature removed." })
    } else {
      toast.add({ type: "error", title: "Couldn't remove signature" })
    }
  }

  if (!editing && saved) {
    return <SavedView svg={saved} onRedraw={() => setEditing(true)} onClear={handleClear} pending={pending} />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tab switcher */}
      <div className="inline-flex rounded-lg border border-border bg-muted p-1 gap-1 self-start">
        {(["draw", "type"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {t === "draw" ? <PencilIcon className="size-3.5" /> : <TypeIcon className="size-3.5" />}
            {t === "draw" ? "Draw" : "Type"}
          </button>
        ))}
      </div>

      {tab === "draw" ? (
        <DrawTab onSave={handleSave} pending={pending} onCancel={saved ? () => setEditing(false) : undefined} />
      ) : (
        <TypeTab onSave={handleSave} pending={pending} onCancel={saved ? () => setEditing(false) : undefined} />
      )}
    </div>
  )
}

// ── Draw tab ─────────────────────────────────────────────────────────────────

function DrawTab({ onSave, pending, onCancel }: { onSave: (svg: string) => void; pending: boolean; onCancel?: () => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [strokes, setStrokes] = React.useState<Stroke[]>([])
  const [current, setCurrent] = React.useState<Stroke | null>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, W, H)
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("color") || "#0a0a0a"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    for (const stroke of current ? [...strokes, current] : strokes) {
      if (stroke.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y)
      ctx.stroke()
    }
  }, [strokes, current])

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); setCurrent([getPos(e, canvasRef.current!.getBoundingClientRect())]) }
  const draw = (e: React.MouseEvent | React.TouchEvent) => { if (!current) return; e.preventDefault(); setCurrent((c) => [...c!, getPos(e, canvasRef.current!.getBoundingClientRect())]) }
  const endDraw = (e: React.MouseEvent | React.TouchEvent) => { if (!current) return; e.preventDefault(); if (current.length > 1) setStrokes((s) => [...s, current]); setCurrent(null) }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-lg border-2 border-dashed border-border bg-background select-none overflow-hidden" style={{ width: W, maxWidth: "100%" }}>
        {strokes.length === 0 && !current && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Draw your signature with mouse or trackpad
          </p>
        )}
        <div className="pointer-events-none absolute bottom-10 left-6 right-6 border-b border-border/50" />
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block w-full cursor-crosshair touch-none"
          style={{ height: H }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || strokes.length === 0} onClick={() => onSave(strokesToSvg(strokes))}>
          <CheckIcon data-icon="inline-start" />
          {pending ? "Saving…" : "Save signature"}
        </Button>
        <Button size="sm" variant="ghost" disabled={strokes.length === 0} onClick={() => setStrokes([])} className="text-muted-foreground">
          <Trash2Icon data-icon="inline-start" />
          Clear
        </Button>
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel} className="text-muted-foreground">Cancel</Button>}
      </div>
    </div>
  )
}

// ── Type tab ─────────────────────────────────────────────────────────────────

function TypeTab({ onSave, pending, onCancel }: { onSave: (svg: string) => void; pending: boolean; onCancel?: () => void }) {
  const [text, setText] = React.useState("")
  const [fontIdx, setFontIdx] = React.useState(0)
  const font = FONTS[fontIdx]

  return (
    <div className="flex flex-col gap-4">
      {/* Name input */}
      <input
        type="text"
        placeholder="Type your name…"
        maxLength={40}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {/* Font picker */}
      <div className="flex flex-wrap gap-2">
        {FONTS.map((f, i) => (
          <button
            key={f.label}
            onClick={() => setFontIdx(i)}
            className={[
              "flex flex-col gap-1 rounded-xl border-2 px-4 py-3 text-left transition-colors",
              i === fontIdx ? "border-primary bg-primary-tint" : "border-border bg-background hover:border-border/80",
            ].join(" ")}
          >
            <span
              className="leading-none text-foreground"
              style={{ fontFamily: f.cssVar, fontSize: 32, fontWeight: f.weight }}
            >
              {text || "Signature"}
            </span>
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{f.label}</span>
          </button>
        ))}
      </div>

      {/* Live preview */}
      {text && (
        <div className="rounded-lg border border-border bg-background px-6 py-4 text-foreground" style={{ maxWidth: W }}>
          <span
            className="leading-none"
            style={{ fontFamily: font.cssVar, fontSize: font.size, fontWeight: font.weight }}
          >
            {text}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !text.trim()} onClick={() => onSave(textToSvg(text.trim(), font))}>
          <CheckIcon data-icon="inline-start" />
          {pending ? "Saving…" : "Save signature"}
        </Button>
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel} className="text-muted-foreground">Cancel</Button>}
      </div>
    </div>
  )
}
