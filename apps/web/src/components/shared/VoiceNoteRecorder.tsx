// apps/web/src/components/shared/VoiceNoteRecorder.tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, Square, Trash2, Upload } from "lucide-react"
import {
  VOICE_NOTE_MAX_DURATION_MS,
  formatVoiceDuration,
} from "@sts/shared"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Phase = "idle" | "recording" | "preview" | "sending"

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return ""
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
}

export function VoiceNoteRecorder({
  disabled,
  onSend,
  className,
}: {
  disabled?: boolean
  onSend: (blob: Blob, durationMs: number) => Promise<void>
  className?: string
}) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const durationRef = useRef(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const startedAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const resetPreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    blobRef.current = null
    durationRef.current = 0
  }, [previewUrl])

  useEffect(() => {
    return () => {
      clearTimer()
      stopStream()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const finishRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.stop()
    }
  }, [])

  const startRecording = async () => {
    setError(null)
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Voice notes need a recent browser with a microphone.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickMime()
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        clearTimer()
        stopStream()
        const type = recorder.mimeType || mime || "audio/webm"
        const blob = new Blob(chunksRef.current, { type })
        const duration = Math.min(
          VOICE_NOTE_MAX_DURATION_MS,
          Math.max(0, performance.now() - startedAtRef.current),
        )
        durationRef.current = duration
        blobRef.current = blob
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setPhase("preview")
      }
      startedAtRef.current = performance.now()
      setElapsedMs(0)
      setPhase("recording")
      recorder.start(250)
      timerRef.current = window.setInterval(() => {
        const next = performance.now() - startedAtRef.current
        setElapsedMs(next)
        if (next >= VOICE_NOTE_MAX_DURATION_MS) {
          finishRecording()
        }
      }, 200)
    } catch {
      stopStream()
      setError("Microphone permission is required to send a voice note.")
      setPhase("idle")
    }
  }

  const discard = () => {
    resetPreview()
    setElapsedMs(0)
    setPhase("idle")
  }

  const send = async () => {
    const blob = blobRef.current
    if (!blob) return
    setPhase("sending")
    try {
      await onSend(blob, durationRef.current)
      discard()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send voice note")
      setPhase("preview")
    }
  }

  if (phase === "recording") {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <span className="size-2 animate-pulse rounded-full bg-danger" aria-hidden />
        <p className="font-mono text-sm">Recording {formatVoiceDuration(elapsedMs)}</p>
        <Button type="button" size="sm" variant="destructive" onClick={finishRecording}>
          <Square className="size-3.5" />
          Stop
        </Button>
      </div>
    )
  }

  if (phase === "preview" || phase === "sending") {
    return (
      <div className={cn("space-y-2", className)}>
        {previewUrl ? (
          <audio controls src={previewUrl} className="w-full" />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={phase === "sending"} onClick={() => void send()}>
            <Upload className="size-3.5" />
            {phase === "sending" ? "Sending…" : "Send voice note"}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={phase === "sending"} onClick={discard}>
            <Trash2 className="size-3.5" />
            Discard
          </Button>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className={cn("space-y-1", className)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => void startRecording()}
      >
        <Mic className="size-3.5" />
        Record voice note
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
