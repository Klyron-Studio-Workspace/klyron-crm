"use client"

import * as React from "react"
import { PauseIcon, PlayIcon } from "lucide-react"

import { fileUrl, type FileDTO } from "@/lib/files/types"
import { cn } from "@/lib/utils"

const BARS = 40
const SPEEDS = [1, 1.5, 2] as const

export function formatClock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

/** Resamples stored bar heights to a fixed number of bars. */
export function resample(values: number[], count: number) {
  if (values.length === 0) return Array.from({ length: count }, () => 8)
  return Array.from({ length: count }, (_, i) => {
    const start = Math.floor((i * values.length) / count)
    const end = Math.max(start + 1, Math.floor(((i + 1) * values.length) / count))
    const slice = values.slice(start, end)
    return Math.max(...slice)
  })
}

// Only one voice note plays at a time, like a phone.
let playing: HTMLAudioElement | null = null

function VoicePlayer({ file, own }: { file: FileDTO; own?: boolean }) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [position, setPosition] = React.useState(0)
  const [speed, setSpeed] = React.useState<(typeof SPEEDS)[number]>(1)
  const duration = file.durationMs ?? 0
  const bars = React.useMemo(() => resample(file.waveform ?? [], BARS), [file.waveform])
  const progress = duration ? Math.min(1, position / duration) : 0

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      if (playing && playing !== audio) playing.pause()
      playing = audio
      audio.playbackRate = speed
      void audio.play()
    } else {
      audio.pause()
    }
  }

  function seek(fraction: number) {
    const audio = audioRef.current
    if (!audio || !duration) return
    audio.currentTime = (fraction * duration) / 1000
    setPosition(fraction * duration)
  }

  return (
    <div
      className={cn(
        "flex w-72 max-w-full items-center gap-3 rounded-2xl border px-3 py-2",
        own ? "border-primary/20 bg-primary-tint" : "border-border bg-card"
      )}
    >
      <audio
        ref={audioRef}
        src={fileUrl(file.id)}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false)
          setPosition(0)
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime * 1000)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-150 ease-out hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95"
      >
        {isPlaying ? <PauseIcon className="size-4" fill="currentColor" /> : <PlayIcon className="ml-0.5 size-4" fill="currentColor" />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Voice message position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration / 1000)}
          aria-valuenow={Math.round(position / 1000)}
          aria-valuetext={`${formatClock(position)} of ${formatClock(duration)}`}
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            seek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") seek(Math.min(1, progress + 0.05))
            if (e.key === "ArrowLeft") seek(Math.max(0, progress - 0.05))
          }}
          className="flex h-7 cursor-pointer items-center gap-[2px] rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {bars.map((h, i) => (
            <span
              key={i}
              aria-hidden
              className={cn("w-[3px] flex-1 rounded-full transition-colors duration-100", i / BARS < progress ? "bg-primary" : "bg-foreground/20")}
              style={{ height: `${Math.max(12, h)}%` }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>{formatClock(isPlaying || position > 0 ? position : duration)}</span>
          <button
            type="button"
            onClick={() => {
              const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
              setSpeed(next)
              if (audioRef.current) audioRef.current.playbackRate = next
            }}
            aria-label={`Playback speed ${speed}×, change speed`}
            className="rounded-full bg-foreground/10 px-1.5 font-medium text-foreground hover:bg-foreground/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {speed}×
          </button>
        </div>
      </div>
    </div>
  )
}

export { VoicePlayer }
