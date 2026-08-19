// packages/shared/src/constants/command-notes.ts
// Control-room replies delivered to the tourist who raised an SOS (or other incident).

export const COMMAND_NOTE_PROVIDER_REF = "command-note" as const

export const COMMAND_NOTE_MAX_LENGTH = 2000

export const COMMAND_NOTE_PRESETS = [
  {
    id: "ack",
    label: "SOS received",
    body: "We received your SOS. Stay where you are. Help is coming.",
  },
  {
    id: "stay",
    label: "Stay put",
    body: "Stay where you are and keep this screen open. An officer has your location.",
  },
  {
    id: "dispatch",
    label: "Help dispatched",
    body: "Help is on the way. Keep your phone on and the app open.",
  },
  {
    id: "safe",
    label: "Move to safety",
    body: "If you can do so safely, move to a well-lit public place and wait.",
  },
] as const

export type CommandNotePresetId = (typeof COMMAND_NOTE_PRESETS)[number]["id"]

export function commandNotePreset(
  id: string,
): (typeof COMMAND_NOTE_PRESETS)[number] | undefined {
  return COMMAND_NOTE_PRESETS.find((preset) => preset.id === id)
}

export function isCommandNoteNotification(input: {
  provider_ref?: string | null
  title?: string | null
}): boolean {
  if (input.provider_ref === COMMAND_NOTE_PROVIDER_REF) return true
  const title = (input.title ?? "").toLowerCase()
  return title.startsWith("control room")
}
