// apps/web/src/components/shared/QrScanner.tsx
"use client"

import { useEffect, useId } from "react"
import { Html5Qrcode } from "html5-qrcode"

import { useLatestRef } from "@/hooks/useLatestRef"

export function QrScanner({
  onDecode,
}: {
  onDecode: (text: string) => void
}) {
  const reactId = useId()
  const hostId = `qr-${reactId.replace(/:/g, "")}`
  const onDecodeRef = useLatestRef(onDecode)

  useEffect(() => {
    const scanner = new Html5Qrcode(hostId)
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
  }, [hostId, onDecodeRef])

  return (
    <div className="overflow-hidden border border-border bg-black">
      <div id={hostId} className="min-h-64 w-full" />
    </div>
  )
}
