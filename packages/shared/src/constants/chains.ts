// packages/shared/src/constants/chains.ts
import { defineChain, type Chain } from "viem";

export const AMOY_CHAIN_ID = 80002;
export const ANVIL_CHAIN_ID = 31337;

export const AMOY_PUBLIC_RPCS = [
  "https://rpc-amoy.polygon.technology",
  "https://polygon-amoy-bor-rpc.publicnode.com",
  "https://rpc.ankr.com/polygon_amoy",
] as const;

export const AMOY_EXPLORER = "https://amoy.polygonscan.com";

export const polygonAmoy: Chain = defineChain({
  id: AMOY_CHAIN_ID,
  name: "Polygon Amoy",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: {
    default: { http: [...AMOY_PUBLIC_RPCS] },
  },
  blockExplorers: {
    default: { name: "Polygonscan", url: AMOY_EXPLORER },
  },
  testnet: true,
})

export const anvilLocal: Chain = defineChain({
  id: ANVIL_CHAIN_ID,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
  testnet: true,
})

export const anvil = anvilLocal
export const AMOY_RPC_URLS = AMOY_PUBLIC_RPCS

export type ChainMode = "amoy" | "anvil-local" | "disabled";

export const KYC_TYPE_ONCHAIN = {
  passport: 1,
  aadhaar: 2,
  voter_id: 3,
  driving_licence: 4,
} as const;

export type KycTypeName = keyof typeof KYC_TYPE_ONCHAIN;

export const ONCHAIN_STATUS = {
  None: 0,
  Active: 1,
  Revoked: 2,
  Suspended: 3,
} as const;

export const ANCHOR_KIND_ONCHAIN = {
  None: 0,
  Incident: 1,
  Resolution: 2,
  EFIR: 3,
  ZoneDefinition: 4,
} as const;
