"use client"

import * as React from "react"

export type Recording = { blob: Blob; mimeType: string; durationMs: number; waveform: number[] }

export const MAX_RECORDING_MS = 15 * 60_000
const MIN_RECORDING_MS = 600
const WAVEFORM_BARS = 64

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ""
}

/** Squeezes per-tick loudness samples into a fixed number of 0-100 bars. */
function toBars(levels: number[]) {
  if (levels.length === 0) return []
  const peak = Math.max(...levels, 0.01)
  return Array.from({ length: WAVEFORM_BARS }, (_, i) => {
    const start = Math.floor((i * levels.length) / WAVEFORM_BARS)
    const end = Math.max(start + 1, Math.floor(((i + 1) * levels.length) / WAVEFORM_BARS))
    const avg = levels.slice(start, end).reduce((a, b) => a + b, 0) / (end - start)
    return Math.round(Math.min(100, (avg / peak) * 100))
  })
}

type Session = {
  stream: MediaStream
  recorder: MediaRecorder
  context: AudioContext
  analyser: AnalyserNode
  chunks: Blob[]
  levels: number[]
  startedAt: number
  frame: number
  stopTimer: ReturnType<typeof setTimeout>
}

/** One visualizer frame: frequency bars on the canvas, plus a loudness sample for the stored waveform. */
function drawFrame(s: Session, canvas: HTMLCanvasElement | null) {
  const bins = new Uint8Array(s.analyser.frequencyBinCount)
  s.analyser.getByteFrequencyData(bins)
  // Loudness for the stored waveform.
  const voice = bins.slice(2, 64)
  s.levels.push(voice.reduce((a, b) => a + b, 0) / voice.length)

  const ctx = canvas?.getContext("2d")
  if (canvas && ctx) {
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const color = getComputedStyle(canvas).color || "#DC143C"
    const count = Math.max(8, Math.floor(w / 5))
    // Log-spaced bands (like hearing): speech harmonics spread across the whole bar.
    const lo = 1
    const hi = voice.length - 1
    for (let i = 0; i < count; i++) {
      const from = Math.floor(lo * Math.pow(hi / lo, i / count))
      const to = Math.max(from + 1, Math.floor(lo * Math.pow(hi / lo, (i + 1) / count)))
      let peak = 0
      for (let b = from; b < to && b < voice.length; b++) peak = Math.max(peak, voice[b])
      const v = peak / 255
      const barH = Math.max(3, v * h)
      ctx.fillStyle = color
      ctx.globalAlpha = 0.35 + v * 0.65
      ctx.beginPath()
      ctx.roundRect(i * 5, (h - barH) / 2, 3, barH, 1.5)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

/**
 * Records the microphone with MediaRecorder and exposes a live frequency
 * analyser for the visualizer. Also samples loudness to build the waveform
 * shown on the voice note.
 */
export function useVoiceRecorder({ onAutoStop }: { onAutoStop?: () => void } = {}) {
  const session = React.useRef<Session | null>(null)
  const [recording, setRecording] = React.useState(false)
  const [startedAt, setStartedAt] = React.useState(0)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const autoStop = React.useRef(onAutoStop)
  React.useEffect(() => {
    autoStop.current = onAutoStop
  })

  const teardown = React.useCallback(() => {
    const s = session.current
    if (!s) return
    cancelAnimationFrame(s.frame)
    clearTimeout(s.stopTimer)
    s.stream.getTracks().forEach((t) => t.stop())
    void s.context.close().catch(() => {})
    session.current = null
    setRecording(false)
  }, [])

  React.useEffect(() => teardown, [teardown])


  /** Asks for the mic and starts recording. Returns an error message, or null on success. */
  const start = React.useCallback(async (): Promise<string | null> => {
    if (session.current) return null
    const mimeType = pickMimeType()
    if (mimeType === null || !navigator.mediaDevices?.getUserMedia) return "This browser can't record audio."
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch (error) {
      return error instanceof DOMException && error.name === "NotAllowedError"
        ? "Microphone access is blocked. Allow it from the browser's address bar."
        : "Couldn't use the microphone."
    }
    const context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.6
    context.createMediaStreamSource(stream).connect(analyser)
    const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32_000 })
    const s: Session = {
      stream,
      recorder,
      context,
      analyser,
      chunks: [],
      levels: [],
      startedAt: Date.now(),
      frame: 0,
      stopTimer: setTimeout(() => autoStop.current?.(), MAX_RECORDING_MS),
    }
    recorder.ondataavailable = (e) => e.data.size && s.chunks.push(e.data)
    recorder.start(250)
    session.current = s
    setStartedAt(s.startedAt)
    setRecording(true)
    const loop = () => {
      if (session.current !== s) return
      drawFrame(s, canvasRef.current)
      s.frame = requestAnimationFrame(loop)
    }
    s.frame = requestAnimationFrame(loop)
    return null
  }, [])

  /** Stops and returns the recording (null if it was too short to keep). */
  const stop = React.useCallback(async (): Promise<Recording | null> => {
    const s = session.current
    if (!s) return null
    const durationMs = Date.now() - s.startedAt
    const done = new Promise<void>((resolve) => {
      s.recorder.onstop = () => resolve()
    })
    if (s.recorder.state !== "inactive") s.recorder.stop()
    await done
    const mimeType = s.recorder.mimeType || "audio/webm"
    const blob = new Blob(s.chunks, { type: mimeType })
    const waveform = toBars(s.levels)
    teardown()
    if (durationMs < MIN_RECORDING_MS || blob.size === 0) return null
    return { blob, mimeType: mimeType.split(";")[0], durationMs, waveform }
  }, [teardown])

  const cancel = React.useCallback(() => {
    const s = session.current
    if (s && s.recorder.state !== "inactive") {
      s.recorder.onstop = null
      s.recorder.stop()
    }
    teardown()
  }, [teardown])

  return { recording, startedAt, start, stop, cancel, canvasRef }
}
