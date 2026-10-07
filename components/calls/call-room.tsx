"use client"

import "@livekit/components-styles"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useDataChannel,
  useLocalParticipant,
  useRoomContext,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react"
import { Track } from "livekit-client"
import {
  CaptionsIcon,
  CaptionsOffIcon,
  CheckIcon,
  LoaderCircleIcon,
  MicIcon,
  MicOffIcon,
  MonitorUpIcon,
  MoreHorizontalIcon,
  PhoneOffIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react"

import { FormAlert } from "@/components/forms/form-alert"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/components/ui/toast"
import { isSpeechSupported, useSpeechTranscription } from "@/hooks/use-speech-transcription"
import { endCall } from "@/lib/actions/calls"
import { cn } from "@/lib/utils"

const languages = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-IN", label: "English (India)" },
  { value: "ur-PK", label: "Urdu" },
  { value: "ar-SA", label: "Arabic" },
]

const CAPTION_TOPIC = "caption"
const encoder = new TextEncoder()
const decoder = new TextDecoder()

type Caption = { name: string; text: string; at: number }

// ─── Transcription + live captions ─────────────────────────────────────────

/** Transcribes the local mic, saves finished phrases and shares live captions with the room. */
function useCallTranscription({ callId, enabled, lang, onCaption }: { callId: string; enabled: boolean; lang: string; onCaption: (identity: string, caption: Caption) => void }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()
  const { send } = useDataChannel(CAPTION_TOPIC, (msg) => {
    if (!msg.from) return
    try {
      const data = JSON.parse(decoder.decode(msg.payload)) as { text: string }
      onCaption(msg.from.identity, { name: msg.from.name || "Someone", text: String(data.text).slice(0, 300), at: Date.now() })
    } catch {
      // Ignore malformed captions.
    }
  })
  const share = React.useCallback(
    (text: string) => {
      onCaption(localParticipant.identity, { name: "You", text, at: Date.now() })
      void send(encoder.encode(JSON.stringify({ text })), { reliable: false, topic: CAPTION_TOPIC }).catch(() => {})
    },
    [localParticipant.identity, onCaption, send]
  )

  return useSpeechTranscription({
    active: enabled && isMicrophoneEnabled,
    lang,
    onInterim: share,
    onFinal: (text, startedAt) => {
      share(text)
      void fetch(`/api/calls/${callId}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, spokenAt: startedAt.toISOString() }),
        keepalive: true,
      }).catch(() => {})
    },
  })
}

// ─── Video stage ───────────────────────────────────────────────────────────

/** Simple grid: everyone's camera (or initials when it's off); a screen share takes the stage. */
function Stage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  )
  const screens = tracks.filter((t) => t.source === Track.Source.ScreenShare)
  const cameras = tracks.filter((t) => t.source === Track.Source.Camera)
  const key = (t: TrackReferenceOrPlaceholder) => `${t.participant.identity}-${t.source}`

  if (screens.length > 0) {
    return (
      <div className="grid h-full min-h-0 gap-2 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <ParticipantTile trackRef={screens[0]} className="min-h-0 rounded-lg" />
        <div className="flex min-h-0 gap-2 overflow-auto lg:flex-col">
          {cameras.map((t) => (
            <ParticipantTile key={key(t)} trackRef={t} className="aspect-video w-48 shrink-0 rounded-lg lg:w-full" />
          ))}
        </div>
      </div>
    )
  }

  const n = cameras.length
  return (
    <div
      className={cn(
        "grid h-full min-h-0 auto-rows-fr gap-2",
        n <= 1 ? "grid-cols-1" : n <= 4 ? "grid-cols-1 sm:grid-cols-2" : n <= 9 ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-3 lg:grid-cols-4"
      )}
    >
      {cameras.map((t) => (
        <ParticipantTile key={key(t)} trackRef={t} className="min-h-0 rounded-lg" />
      ))}
    </div>
  )
}

// ─── Controls ──────────────────────────────────────────────────────────────

function ControlButton({ label, active, onClick, children, danger }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={active ? "secondary" : "destructive"}
            size="icon-lg"
            aria-label={label}
            aria-pressed={!danger ? active : undefined}
            onClick={onClick}
            className="rounded-full"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

type ControlsProps = {
  transcribe: boolean
  onTranscribeChange: (on: boolean) => void
  speechSupported: boolean
  lang: string
  onLangChange: (lang: string) => void
  canEndForEveryone: boolean
  onEndForEveryone: () => void
  ending: boolean
}

function Controls({ transcribe, onTranscribeChange, speechSupported, lang, onLangChange, canEndForEveryone, onEndForEveryone, ending }: ControlsProps) {
  const room = useRoomContext()
  const toast = useToast()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant()

  const toggle = (what: string, task: () => Promise<unknown>) =>
    task().catch(() => toast.add({ type: "error", title: `Couldn't turn ${what}`, description: "Check that the browser is allowed to use it (address bar)." }))

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      <ControlButton label={isMicrophoneEnabled ? "Mute" : "Unmute"} active={isMicrophoneEnabled} onClick={() => toggle(isMicrophoneEnabled ? "off the mic" : "on the mic", () => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled))}>
        {isMicrophoneEnabled ? <MicIcon /> : <MicOffIcon />}
      </ControlButton>
      <ControlButton label={isCameraEnabled ? "Turn camera off" : "Turn camera on"} active={isCameraEnabled} onClick={() => toggle(isCameraEnabled ? "off the camera" : "on the camera", () => localParticipant.setCameraEnabled(!isCameraEnabled))}>
        {isCameraEnabled ? <VideoIcon /> : <VideoOffIcon />}
      </ControlButton>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant={isScreenShareEnabled ? "default" : "secondary"}
              size="icon-lg"
              aria-label={isScreenShareEnabled ? "Stop sharing" : "Share screen"}
              aria-pressed={isScreenShareEnabled}
              onClick={() => toggle("on screen sharing", () => localParticipant.setScreenShareEnabled(!isScreenShareEnabled))}
              className="hidden rounded-full sm:inline-flex"
            />
          }
        >
          <MonitorUpIcon />
        </TooltipTrigger>
        <TooltipContent>{isScreenShareEnabled ? "Stop sharing" : "Share screen"}</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={<Button variant={transcribe && speechSupported ? "secondary" : "outline"} size="icon-lg" aria-label="Captions and transcription" className="rounded-full" />}
              />
            }
          >
            {transcribe && speechSupported ? <CaptionsIcon /> : <CaptionsOffIcon />}
          </TooltipTrigger>
          <TooltipContent>Captions &amp; transcription</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="center" side="top" className="w-64">
          {speechSupported ? (
            <>
              <DropdownMenuItem onClick={() => onTranscribeChange(!transcribe)}>
                {transcribe ? <CaptionsOffIcon /> : <CaptionsIcon />}
                {transcribe ? "Stop transcribing me" : "Transcribe me"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>I&rsquo;m speaking</DropdownMenuLabel>
                {languages.map((l) => (
                  <DropdownMenuItem key={l.value} onClick={() => onLangChange(l.value)}>
                    <CheckIcon className={l.value === lang ? "opacity-100" : "opacity-0"} />
                    {l.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          ) : (
            <DropdownMenuLabel className="font-normal">Transcription and captions work in Chrome and Edge.</DropdownMenuLabel>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="destructive" size="lg" className="ml-1 rounded-full px-5" onClick={() => void room.disconnect()}>
        <PhoneOffIcon data-icon="inline-start" />
        Leave
      </Button>

      {canEndForEveryone && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-lg" aria-label="More call options" className="rounded-full" />}>
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-52">
            <DropdownMenuItem variant="destructive" disabled={ending} onClick={onEndForEveryone}>
              <PhoneOffIcon /> End call for everyone
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

// ─── Room ──────────────────────────────────────────────────────────────────

type InCallProps = Omit<ControlsProps, "onTranscribeChange" | "onLangChange"> & { callId: string }

function InCall({ callId, transcribe, speechSupported, lang, ...controls }: InCallProps & { onTranscribeChange: (on: boolean) => void; onLangChange: (l: string) => void }) {
  const [captions, setCaptions] = React.useState<Record<string, Caption>>({})
  const onCaption = React.useCallback((identity: string, caption: Caption) => {
    setCaptions((prev) => ({ ...prev, [identity]: caption }))
  }, [])
  // Captions fade a few seconds after someone stops talking.
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCaptions((prev) => {
        const fresh = Object.entries(prev).filter(([, c]) => c.text && Date.now() - c.at < 4000)
        return fresh.length === Object.keys(prev).length ? prev : Object.fromEntries(fresh)
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])
  const { error: speechError } = useCallTranscription({ callId, enabled: transcribe && speechSupported, lang, onCaption })
  const active = Object.values(captions).filter((c) => c.text).slice(-2)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div data-lk-theme="default" className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-neutral-950 p-2">
        <Stage />
        {active.length > 0 && (
          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center gap-1 px-4">
            {active.map((c, i) => (
              <p key={i} className="max-w-3xl rounded-md bg-black/75 px-3 py-1.5 text-center text-sm text-white">
                <span className="font-semibold">{c.name}:</span> {c.text}
              </p>
            ))}
          </div>
        )}
      </div>
      <RoomAudioRenderer />
      <Controls transcribe={transcribe} speechSupported={speechSupported} lang={lang} {...controls} />
      <p className="text-center text-xs text-muted-foreground">
        {speechError ??
          (transcribe && speechSupported
            ? "You're being transcribed in your browser for the meeting notes. Turn it off from the captions button."
            : "You're not being transcribed.")}
      </p>
    </div>
  )
}

type CallRoomProps = {
  callId: string
  title: string
  canEndForEveryone: boolean
  /** Where to go after leaving. */
  afterHref: string
}

function CallRoom({ callId, title, canEndForEveryone, afterHref }: CallRoomProps) {
  const router = useRouter()
  const toast = useToast()
  const [connection, setConnection] = React.useState<{ token: string; url: string } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [deviceBlocked, setDeviceBlocked] = React.useState(false)
  const [transcribe, setTranscribe] = React.useState(true)
  const [lang, setLang] = React.useState("en-US")
  const [ending, startEnding] = React.useTransition()
  const connected = React.useRef(false)
  const speechSupported = React.useSyncExternalStore(() => () => {}, isSpeechSupported, () => true)

  React.useEffect(() => {
    let cancelled = false
    fetch(`/api/calls/${callId}/token`, { method: "POST" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok) setConnection(body)
        else setError(body.error ?? "Couldn't join the call.")
      })
      .catch(() => !cancelled && setError("Couldn't reach the server."))
    return () => {
      cancelled = true
    }
  }, [callId])

  const leave = React.useCallback(() => {
    router.push(afterHref)
    router.refresh()
  }, [router, afterHref])

  const endForEveryone = () =>
    startEnding(async () => {
      const result = await endCall(callId)
      if (!result.ok) toast.add({ type: "error", title: "Couldn't end the call", description: result.error })
      else leave()
    })

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <FormAlert tone="error">{error}</FormAlert>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={leave}>
            Back
          </Button>
          {canEndForEveryone && (
            <Button variant="destructive" disabled={ending} onClick={endForEveryone}>
              <PhoneOffIcon data-icon="inline-start" />
              End for everyone
            </Button>
          )}
        </div>
      </div>
    )
  }
  if (!connection) {
    return (
      <div className="flex h-[60svh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
        Joining {title}…
      </div>
    )
  }

  return (
    <LiveKitRoom
      serverUrl={connection.url}
      token={connection.token}
      connect
      video
      audio
      onConnected={() => {
        connected.current = true
      }}
      onDisconnected={() => {
        // Leaving (or the call ending) after being in the room goes back; a failed connect stays to explain.
        if (connected.current) leave()
      }}
      onMediaDeviceFailure={() => setDeviceBlocked(true)}
      onError={(e) => {
        // Camera/mic problems (blocked, missing, in use) aren't connection failures: stay in the call.
        if (/^(NotAllowed|NotFound|NotReadable|Overconstrained|Abort)Error$/.test(e.name) || /permission|device/i.test(e.message)) {
          setDeviceBlocked(true)
          return
        }
        // A cancelled attempt (e.g. React re-mounting in development) isn't a failure.
        if (/client initiated disconnect|cancel/i.test(e.message)) return
        if (!connected.current) setError("Couldn't connect to the video server. Check your connection and try again; if it keeps happening, the call server may be down.")
      }}
      className="flex h-[calc(100svh-9.5rem)] min-h-[26rem] flex-col gap-3"
    >
      {deviceBlocked && (
        <p role="status" className="rounded-lg border border-warning/30 bg-warning-tint px-3 py-2 text-sm text-warning">
          Your camera or microphone is blocked or in use. You&rsquo;re in the call anyway: allow access from the browser&rsquo;s address bar, then turn them on below.
        </p>
      )}
      <InCall
        callId={callId}
        transcribe={transcribe}
        onTranscribeChange={setTranscribe}
        speechSupported={speechSupported}
        lang={lang}
        onLangChange={setLang}
        canEndForEveryone={canEndForEveryone}
        onEndForEveryone={endForEveryone}
        ending={ending}
      />
    </LiveKitRoom>
  )
}

export { CallRoom }
