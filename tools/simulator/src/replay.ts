// tools/simulator/src/replay.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { recordingSchema, type Recording, type RecordingEvent, type SimPlan } from "./types.ts"

export function writeRecording(path: string, recording: Recording): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(recording, null, 2)}\n`, "utf8")
}

export function readRecording(path: string): Recording {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"))
  return recordingSchema.parse(raw)
}

export function emptyRecording(
  plan: SimPlan,
  seed: number,
  speed: number,
  tickMs: number,
): Recording {
  return {
    version: 1,
    seed,
    scenario: plan.scenario,
    speed,
    tickMs,
    originIso: plan.originIso,
    tourists: plan.tourists.map((t) => ({
      slot: t.slot,
      label: t.label,
      email: t.email,
      routeId: t.routeId,
    })),
    events: [],
  }
}

export function appendEvents(recording: Recording, events: RecordingEvent[]): void {
  recording.events.push(...events)
}
