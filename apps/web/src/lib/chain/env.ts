// apps/web/src/lib/chain/env.ts
import "server-only";

import {
  AMOY_CHAIN_ID,
  AMOY_EXPLORER,
  AMOY_PUBLIC_RPCS,
  ANVIL_CHAIN_ID,
  type ChainMode,
} from "@sts/shared";

function read(name: string): string {
  return process.env[name] ?? "";
}

export function chainMode(): ChainMode {
  const value = read("CHAIN_MODE");
  if (value === "anvil-local" || value === "disabled" || value === "amoy") {
    return value;
  }
  return "amoy";
}

export function piiEncryptionKey(): string {
  const value = read("PII_ENCRYPTION_KEY");
  if (value) return value;
  if (read("DB_MODE") === "supabase-local") {
    return "dev-only-pii-key";
  }
  throw new Error("missing env PII_ENCRYPTION_KEY");
}

export function pipelineSecret(): string {
  return read("PIPELINE_SECRET");
}

export function touristHdMnemonic(): string {
  const value = read("TOURIST_HD_MNEMONIC");
  if (value) return value;
  if (chainMode() === "anvil-local") {
    return "test test test test test test test test test test test junk";
  }
  throw new Error("missing env TOURIST_HD_MNEMONIC");
}

export function issuerPrivateKey(): `0x${string}` {
  const key = read("ISSUER_PRIVATE_KEY");
  if (chainMode() === "anvil-local" && (isZeroHex(key) || key.length !== 66)) {
    return "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  }
  if (!key.startsWith("0x") || key.length !== 66) {
    throw new Error("ISSUER_PRIVATE_KEY must be a 32-byte hex key");
  }
  return key as `0x${string}`;
}

export function issuerAddress(): `0x${string}` {
  const value = read("ISSUER_ADDRESS");
  if (chainMode() === "anvil-local" && (isZeroHex(value) || value.length !== 42)) {
    return "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  }
  if (value.startsWith("0x") && value.length === 42) {
    return value as `0x${string}`;
  }
  return "0x0000000000000000000000000000000000000000";
}

export function rpcUrls(): readonly [string, string, string] {
  if (chainMode() === "anvil-local") {
    const local = read("LOCAL_RPC_URL") || "http://127.0.0.1:8545";
    return [local, local, local];
  }
  return [
    read("RPC_URL_PRIMARY") || AMOY_PUBLIC_RPCS[0],
    read("RPC_URL_FALLBACK_1") || AMOY_PUBLIC_RPCS[1],
    read("RPC_URL_FALLBACK_2") || AMOY_PUBLIC_RPCS[2],
  ];
}

export function publicChainId(): number {
  if (chainMode() === "anvil-local") {
    return ANVIL_CHAIN_ID;
  }
  const raw = read("NEXT_PUBLIC_CHAIN_ID");
  const parsed = Number.parseInt(raw || String(AMOY_CHAIN_ID), 10);
  return Number.isFinite(parsed) ? parsed : AMOY_CHAIN_ID;
}

export function blockExplorerBase(): string {
  if (chainMode() === "anvil-local") {
    return "";
  }
  return read("NEXT_PUBLIC_BLOCK_EXPLORER") || AMOY_EXPLORER;
}

export function registryAddressEnv(): `0x${string}` {
  const value = read("NEXT_PUBLIC_TOURIST_ID_REGISTRY_ADDRESS");
  if (value.startsWith("0x") && value.length === 42) {
    return value as `0x${string}`;
  }
  return "0x0000000000000000000000000000000000000000";
}

export function incidentAnchorAddressEnv(): `0x${string}` {
  const value = read("NEXT_PUBLIC_INCIDENT_ANCHOR_ADDRESS");
  if (value.startsWith("0x") && value.length === 42) {
    return value as `0x${string}`;
  }
  return "0x0000000000000000000000000000000000000000";
}

export function storageBuckets(): {
  docs: string;
  efir: string;
  public: string;
  voice: string;
} {
  return {
    docs: read("SUPABASE_BUCKET_DOCS") || "tourist-docs",
    efir: read("SUPABASE_BUCKET_EFIR") || "efir",
    public: read("SUPABASE_BUCKET_PUBLIC") || "public-assets",
    voice: read("SUPABASE_BUCKET_VOICE") || "incident-voice",
  };
}

export function anchorBatchSize(): number {
  const n = Number.parseInt(read("ANCHOR_BATCH_SIZE") || "10", 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

export function anchorMaxAttempts(): number {
  const n = Number.parseInt(read("ANCHOR_MAX_ATTEMPTS") || "5", 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

export function isZeroHex(value: string): boolean {
  return /^0x0+$/i.test(value);
}

export function databaseUrl(): string {
  if (read("DB_MODE") === "supabase-local") {
    return (
      read("LOCAL_DATABASE_URL") ||
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    );
  }
  return read("DATABASE_URL");
}

export function anomalyThreshold(): number {
  const n = Number.parseFloat(read("ANOMALY_THRESHOLD") || "0.72");
  return Number.isFinite(n) ? n : 0.72;
}

export function anchorMinSeverity():
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical" {
  const value = read("ANCHOR_MIN_SEVERITY");
  if (
    value === "info" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "critical"
  ) {
    return value;
  }
  return "high";
}
