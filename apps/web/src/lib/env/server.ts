// apps/web/src/lib/env/server.ts
import "server-only"

import {
  LOCAL_SUPABASE_ANON_JWT,
  LOCAL_SUPABASE_SERVICE_ROLE_JWT,
  LOCAL_SUPABASE_URL_DEFAULT,
} from "@/lib/supabase/local-demo"

function read(name: string): string {
  return process.env[name] ?? ""
}

function isLocalDb(): boolean {
  return (process.env.DB_MODE ?? "supabase-cloud") === "supabase-local"
}

export type AiMode = "groq" | "gemini" | "onnx-local" | "rules-only"

function parseAiMode(raw: string): AiMode {
  const value = raw.split("#")[0]?.trim().replace(/^["']|["']$/g, "") ?? ""
  if (
    value === "groq" ||
    value === "gemini" ||
    value === "onnx-local" ||
    value === "rules-only"
  ) {
    return value
  }
  return "groq"
}

function effectiveAiMode(): AiMode {
  const mode = parseAiMode(process.env.AI_MODE ?? "groq")
  if (mode === "onnx-local" || mode === "rules-only") return mode
  const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim())
  const hasGemini = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim())
  if (!hasGroq && !hasGemini) return "rules-only"
  return mode
}

function parseLocales(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function databaseUrl(): string {
  if (isLocalDb()) {
    return (
      read("LOCAL_DATABASE_URL") ||
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    )
  }
  return read("DATABASE_URL")
}

export const serverEnv = {
  dbMode: process.env.DB_MODE ?? "supabase-cloud",
  chainMode: process.env.CHAIN_MODE ?? "amoy",
  aiMode: effectiveAiMode(),
  supabaseUrl: isLocalDb()
    ? (process.env.LOCAL_SUPABASE_URL || LOCAL_SUPABASE_URL_DEFAULT)
    : (process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
  supabaseAnonKey: isLocalDb()
    ? (process.env.LOCAL_SUPABASE_ANON_KEY || LOCAL_SUPABASE_ANON_JWT)
    : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
  supabaseServiceRoleKey: isLocalDb()
    ? LOCAL_SUPABASE_SERVICE_ROLE_JWT
    : (process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""),
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  llmMaxTokens: Number(process.env.LLM_MAX_TOKENS ?? "512"),
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? "10000"),
  osrmUrl: process.env.OSRM_URL ?? "https://router.project-osrm.org",
  photonUrl: process.env.PHOTON_URL ?? "https://photon.komoot.io/reverse",
  nominatimUrl:
    process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org/reverse",
  nominatimUserAgent:
    process.env.NOMINATIM_USER_AGENT ??
    "SmartTouristSafety/1.0 (sih2025-team-contact@example.com)",
  responderFanout: Number(process.env.RESPONDER_FANOUT_COUNT ?? "3"),
  responderRadiusM: Number(process.env.RESPONDER_SEARCH_RADIUS_M ?? "15000"),
  signalLostMinutes: Number(process.env.SIGNAL_LOST_MINUTES ?? "20"),
  rpcPrimary: process.env.RPC_URL_PRIMARY ?? "https://rpc-amoy.polygon.technology",
  rpcFallback1:
    process.env.RPC_URL_FALLBACK_1 ??
    "https://polygon-amoy-bor-rpc.publicnode.com",
  rpcFallback2: process.env.RPC_URL_FALLBACK_2 ?? "https://rpc.ankr.com/polygon_amoy",
  localRpcUrl: process.env.LOCAL_RPC_URL ?? "http://127.0.0.1:8545",
  pipelineSecret: process.env.PIPELINE_SECRET ?? "",
  piiEncryptionKey: process.env.PII_ENCRYPTION_KEY ?? "",
  hfSpaceUrl: process.env.HF_SPACE_URL ?? "",
  hfSpaceToken: process.env.HF_SPACE_TOKEN ?? "",
  hfSpaceTimeoutMs: Number(process.env.HF_SPACE_TIMEOUT_MS ?? "8000"),
  onnxModelPath:
    process.env.ONNX_MODEL_PATH ?? "./services/ai/artifacts/iforest.onnx",
  anomalyThreshold: Number(process.env.ANOMALY_THRESHOLD ?? "0.72"),
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFrom: process.env.RESEND_FROM ?? "onboarding@resend.dev",
  authorityEmail: process.env.AUTHORITY_EMAIL ?? "",
  notifyChannels: process.env.NOTIFY_CHANNELS ?? "realtime,webpush,telegram,email",
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:team@example.com",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramControlRoomChatId: process.env.TELEGRAM_CONTROL_ROOM_CHAT_ID ?? "",
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  databaseUrl: databaseUrl(),
  logLevel: process.env.LOG_LEVEL ?? "info",
  defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "en",
  supportedLocales: parseLocales(
    process.env.NEXT_PUBLIC_SUPPORTED_LOCALES ?? "en,hi,as,bn,ne",
  ),
  anchorMinSeverity: process.env.ANCHOR_MIN_SEVERITY ?? "high",
  digilockerMode: process.env.DIGILOCKER_MODE ?? "",
  digilockerClientId: process.env.DIGILOCKER_CLIENT_ID ?? "",
  digilockerClientSecret: process.env.DIGILOCKER_CLIENT_SECRET ?? "",
  digilockerRedirectUri: process.env.DIGILOCKER_REDIRECT_URI ?? "",
  digilockerBaseUrl: process.env.DIGILOCKER_BASE_URL ?? "",
  digilockerStateSecret: process.env.DIGILOCKER_STATE_SECRET ?? "",
}

export function isHfSpaceConfigured(): boolean {
  const url = serverEnv.hfSpaceUrl
  return url.length > 0 && !url.includes("<user>")
}
