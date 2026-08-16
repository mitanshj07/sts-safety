// apps/web/src/components/shared/QrScanner.tsx
"use client"

import { useEffect, useRef } from "react"
import { Html5Qrcode } from "html5-qrcode"

export function QrScanner({
  onDecode,
}: {
  onDecode: (text: string) => void
}) {
  const hostId = useRef(`qr-${Math.random().toString(36).slice(2)}`)
  const onDecodeRef = useRef(onDecode)
  onDecodeRef.current = onDecode

  useEffect(() => {
    const scanner = new Html5Qrcode(hostId.current)
    let stopped = false
    void scanner
      .start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (text) => {
          onDecodeRef.current(text)
        },
        () => undefined,
      )
      .catch(() => {
        // Camera permission denied — parent still accepts pasted token ids.
      })
    return () => {
      if (stopped) return
      stopped = true
      void scanner.stop().catch(() => undefined)
    }
  }, [])

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-black">
      <div id={hostId.current} className="min-h-64 w-full" />
    </div>
  )
}
