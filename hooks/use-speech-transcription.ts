"use client"

import * as React from "react"

// Minimal typings for the Web Speech API (Chrome/Edge expose it as webkitSpeechRecognition).
type SpeechAlternative = { transcript: string }
type SpeechResult = { isFinal: boolean; 0: SpeechAlternative }
type SpeechResultEvent = { resultIndex: number; results: ArrayLike<SpeechResult> }
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function recognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechSupported() {
  return recognitionCtor() !== null
}

type Options = {
  /** Listening only happens while this is true (e.g. transcription on and mic unmuted). */
  active: boolean
  lang: string
  /** A finished phrase, with when it started. */
  onFinal: (text: string, startedAt: Date) => void
  /** The phrase as it's being spoken, for live captions. "" when it ends. */
  onInterim?: (text: string) => void
}

/**
 * Transcribes the local microphone in the browser. Recognition stops by itself
 * after silences or network blips, so it's restarted for as long as `active`.
 */
export function useSpeechTranscription({ active, lang, onFinal, onInterim }: Options) {
  // Tagged with the language it happened for, so changing language clears it.
  const [error, setError] = React.useState<{ lang: string; message: string } | null>(null)
  const callbacks = React.useRef({ onFinal, onInterim })
  React.useEffect(() => {
    callbacks.current = { onFinal, onInterim }
  })

  React.useEffect(() => {
    const Ctor = recognitionCtor()
    if (!active || !Ctor) return
    let stopped = false
    let phraseStart: Date | null = null
    let restartTimer: ReturnType<typeof setTimeout> | undefined
    const recognition = new Ctor()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript.trim()
        if (!text) continue
        phraseStart ??= new Date()
        if (result.isFinal) {
          callbacks.current.onFinal(text, phraseStart)
          phraseStart = null
        } else {
          interim += `${text} `
        }
      }
      callbacks.current.onInterim?.(interim.trim())
    }
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        stopped = true
        setError({ lang, message: "The browser blocked speech recognition. Allow microphone access to transcribe." })
      } else if (event.error === "language-not-supported") {
        stopped = true
        setError({ lang, message: "This browser can't transcribe that language." })
      }
      // "no-speech", "aborted" and "network" are normal; onend restarts.
    }
    recognition.onend = () => {
      callbacks.current.onInterim?.("")
      if (!stopped) restartTimer = setTimeout(() => {
        try {
          recognition.start()
        } catch {
          // Already started.
        }
      }, 300)
    }

    try {
      recognition.start()
    } catch {
      // Already started.
    }
    return () => {
      stopped = true
      clearTimeout(restartTimer)
      recognition.onend = null
      recognition.abort()
      callbacks.current.onInterim?.("")
    }
  }, [active, lang])

  return { supported: isSpeechSupported(), error: active && error?.lang === lang ? error.message : null }
}
