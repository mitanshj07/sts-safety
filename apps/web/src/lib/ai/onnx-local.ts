// apps/web/src/lib/ai/onnx-local.ts
import "server-only"

import { existsSync, readFileSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"

import { FEATURE_COUNT } from "@sts/shared/constants/feature-vector"

import { serverEnv } from "@/lib/env/server"
import {
  extractFeatures,
  safetyScoreFromWindow,
  type ScoreItinerary,
  type ScorePing,
  type ScoreZone,
} from "@/lib/ai/features"

export type OnnxScoreResult = {
  anomaly_score: number
  safety_score: number
  source: "onnx-local"
  features: number[]
}

type InferenceSessionStatic = {
  create: (path: string, options?: { executionProviders?: string[] }) => Promise<{
    inputNames: string[]
    outputNames: string[]
    run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array | Int32Array | BigInt64Array; dims: number[] }>>
  }>
}

type TensorCtor = new (
  type: "float32",
  data: Float32Array,
  dims: number[],
) => unknown

type OrtModule = {
  InferenceSession: InferenceSessionStatic
  Tensor: TensorCtor
}

type ScalerSpec = {
  mean: number[]
  scale: number[]
}

let sessionPromise: Promise<{
  session: Awaited<ReturnType<InferenceSessionStatic["create"]>>
  inputName: string
  scaler: ScalerSpec
  Tensor: TensorCtor
} | null> | null = null

function candidatePaths(raw: string): string[] {
  const cwd = process.cwd()
  const rel = raw.startsWith("./") ? raw.slice(2) : raw
  return [
    isAbsolute(raw) ? raw : resolve(cwd, raw),
    resolve(cwd, "..", "..", rel),
    resolve(cwd, "services/ai/artifacts/iforest.onnx"),
    resolve(cwd, "../../services/ai/artifacts/iforest.onnx"),
    join(cwd, rel),
  ]
}

function resolveModelPath(): string | null {
  for (const path of candidatePaths(serverEnv.onnxModelPath)) {
    if (existsSync(path)) return path
  }
  return null
}

function loadScaler(modelPath: string): ScalerSpec | null {
  const dir = dirname(modelPath)
  const scalerPath = join(dir, "scaler.json")
  if (!existsSync(scalerPath)) return null
  const parsed = JSON.parse(readFileSync(scalerPath, "utf8")) as {
    mean?: unknown
    scale?: unknown
  }
  if (!Array.isArray(parsed.mean) || !Array.isArray(parsed.scale)) return null
  const mean = parsed.mean.filter((n): n is number => typeof n === "number")
  const scale = parsed.scale.filter((n): n is number => typeof n === "number")
  if (mean.length !== FEATURE_COUNT || scale.length !== FEATURE_COUNT) return null
  return { mean, scale }
}

function applyScaler(vector: number[], spec: ScalerSpec): Float32Array {
  const out = new Float32Array(FEATURE_COUNT)
  for (let i = 0; i < FEATURE_COUNT; i += 1) {
    const x = vector[i] ?? 0
    const mean = spec.mean[i] ?? 0
    const scale = spec.scale[i] ?? 1
    const denom = Math.abs(scale) < 1e-12 ? 1 : scale
    out[i] = (x - mean) / denom
  }
  return out
}

function unitScore(decision: number): number {
  const s = 1 / (1 + Math.exp(decision))
  if (!Number.isFinite(s)) return 0
  return Math.min(1, Math.max(0, s))
}

function parseDecision(
  outputs: Record<string, { data: Float32Array | Int32Array | BigInt64Array; dims: number[] }>,
): number {
  for (const value of Object.values(outputs)) {
    if (value.data instanceof Int32Array || value.data instanceof BigInt64Array) {
      continue
    }
    if (value.data instanceof Float32Array && value.data.length >= 1) {
      if (value.dims.length === 2 && value.dims[1] === 2) {
        const last = value.data[value.data.length - 1]
        return typeof last === "number" ? last : 0
      }
      const first = value.data[0]
      if (typeof first === "number") return first
    }
  }
  throw new Error("unrecognised IsolationForest ONNX outputs")
}

async function loadOrt(): Promise<OrtModule | null> {
  try {
    return (await import("onnxruntime-node")) as unknown as OrtModule
  } catch {
    return null
  }
}

async function getSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const modelPath = resolveModelPath()
      if (!modelPath) return null
      const scaler = loadScaler(modelPath)
      if (!scaler) return null
      const ort = await loadOrt()
      if (!ort) return null
      const session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ["cpu"],
      })
      const inputName = session.inputNames[0] ?? "features"
      return { session, inputName, scaler, Tensor: ort.Tensor }
    })()
  }
  return sessionPromise
}

export async function scoreWithOnnx(args: {
  pings: ScorePing[]
  itinerary: ScoreItinerary | null
  zones: ScoreZone[]
  openHighIncidents: number
}): Promise<OnnxScoreResult> {
  const loaded = await getSession()
  if (!loaded) {
    throw new Error("onnx_unavailable")
  }
  const window = extractFeatures(args.pings, args.itinerary, args.zones)
  const scaled = applyScaler(window.vector, loaded.scaler)
  const tensor = new loaded.Tensor("float32", scaled, [1, FEATURE_COUNT])
  const outputs = await loaded.session.run({ [loaded.inputName]: tensor })
  const decision = parseDecision(outputs)
  const anomaly = unitScore(decision)
  const last = args.pings[args.pings.length - 1] ?? null
  const safety = safetyScoreFromWindow({
    window,
    zones: args.zones,
    lastPing: last,
    openHighIncidents: args.openHighIncidents,
    anomalyScore: anomaly,
    itinerary: args.itinerary,
  })
  return {
    anomaly_score: anomaly,
    safety_score: safety,
    source: "onnx-local",
    features: window.vector,
  }
}

export async function onnxAvailable(): Promise<boolean> {
  const loaded = await getSession()
  return loaded !== null
}
