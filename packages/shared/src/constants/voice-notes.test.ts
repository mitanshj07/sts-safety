import { describe, expect, it } from "vitest"
import {
  SOS_MESSAGE_MAX_LENGTH,
  VOICE_NOTE_MAX_BYTES,
  formatVoiceDuration,
  isAllowedVoiceMime,
  touristSosMessage,
  voiceExtension,
} from "./voice-notes"

describe("voice notes", () => {
  it("keeps the SOS line short enough for one SMS segment", () => {
    expect(SOS_MESSAGE_MAX_LENGTH).toBe(280)
    expect(VOICE_NOTE_MAX_BYTES).toBe(1_048_576)
  })

  it("accepts MediaRecorder mime types with codecs stripped", () => {
    expect(isAllowedVoiceMime("audio/webm;codecs=opus")).toBe(true)
    expect(isAllowedVoiceMime("audio/mp4")).toBe(true)
    expect(isAllowedVoiceMime("application/pdf")).toBe(false)
    expect(voiceExtension("audio/webm;codecs=opus")).toBe("webm")
    expect(voiceExtension("audio/mp4")).toBe("m4a")
  })

  it("reads the optional SOS line from incident payload", () => {
    expect(touristSosMessage({ source: "panic_button" })).toBeNull()
    expect(touristSosMessage({ tourist_message: "   " })).toBeNull()
    expect(touristSosMessage({ tourist_message: "  Near the river  " })).toBe(
      "Near the river",
    )
  })

  it("formats durations as m:ss", () => {
    expect(formatVoiceDuration(0)).toBe("0:00")
    expect(formatVoiceDuration(45_000)).toBe("0:45")
    expect(formatVoiceDuration(61_400)).toBe("1:01")
  })
})
