import { describe, expect, it } from "vitest"
import {
  COMMAND_NOTE_MAX_LENGTH,
  COMMAND_NOTE_PRESETS,
  COMMAND_NOTE_PROVIDER_REF,
  commandNotePreset,
  isCommandNoteNotification,
} from "./command-notes"

describe("command notes", () => {
  it("exposes non-empty presets within the max length", () => {
    expect(COMMAND_NOTE_PRESETS.length).toBeGreaterThan(0)
    for (const preset of COMMAND_NOTE_PRESETS) {
      expect(preset.body.trim().length).toBeGreaterThan(0)
      expect(preset.body.length).toBeLessThanOrEqual(COMMAND_NOTE_MAX_LENGTH)
      expect(commandNotePreset(preset.id)?.body).toBe(preset.body)
    }
  })

  it("recognises control-room inbox rows", () => {
    expect(COMMAND_NOTE_PROVIDER_REF).toBe("command-note")
    expect(
      isCommandNoteNotification({ provider_ref: COMMAND_NOTE_PROVIDER_REF }),
    ).toBe(true)
    expect(isCommandNoteNotification({ title: "Control room" })).toBe(true)
    expect(
      isCommandNoteNotification({
        provider_ref: "webpush",
        title: "CRITICAL · SOS panic",
      }),
    ).toBe(false)
  })
})
