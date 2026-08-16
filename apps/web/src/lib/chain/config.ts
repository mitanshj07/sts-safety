// apps/web/src/lib/chain/config.ts
import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Address, Hex } from "viem";

import {
  blockExplorerBase,
  chainMode,
  incidentAnchorAddressEnv,
  isZeroHex,
  publicChainId,
  registryAddressEnv,
} from "@/lib/chain/env";

type DeploymentFile = {
  chainId: number;
  network: string;
  TouristIdentityRegistry: { address: string; deployedAtBlock: number };
  IncidentAnchor: { address: string; deployedAtBlock: number };
  issuerAddress: string;
};

function readDeployment(): DeploymentFile | null {
  const file = chainMode() === "anvil-local" ? "anvil.json" : "amoy.json";
  const candidates = [
    join(process.cwd(), "../../packages/contracts/deployments", file),
    join(process.cwd(), "packages/contracts/deployments", file),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf8")) as DeploymentFile;
    }
  }
  return null;
}

export function registryAddress(): Address {
  const fromEnv = registryAddressEnv();
  if (!isZeroHex(fromEnv)) {
    return fromEnv;
  }
  const deployed = readDeployment()?.TouristIdentityRegistry.address;
  if (deployed && !isZeroHex(deployed)) {
    return deployed as Address;
  }
  return fromEnv;
}

export function incidentAnchorAddress(): Address {
  const fromEnv = incidentAnchorAddressEnv();
  if (!isZeroHex(fromEnv)) {
    return fromEnv;
  }
  const deployed = readDeployment()?.IncidentAnchor.address;
  if (deployed && !isZeroHex(deployed)) {
    return deployed as Address;
  }
  return fromEnv;
}

export function explorerTxUrl(txHash: Hex | null): string | null {
  const base = blockExplorerBase();
  if (!base || !txHash || isZeroHex(txHash)) {
    return null;
  }
  return `${base.replace(/\/$/, "")}/tx/${txHash}`;
}

export function explorerAddressUrl(address: Address): string | null {
  const base = blockExplorerBase();
  if (!base || isZeroHex(address)) {
    return null;
  }
  return `${base.replace(/\/$/, "")}/address/${address}`;
}

export function explorerTokenUrl(tokenId: bigint): string | null {
  const base = blockExplorerBase();
  const contract = registryAddress();
  if (!base || isZeroHex(contract)) {
    return null;
  }
  return `${base.replace(/\/$/, "")}/token/${contract}?a=${tokenId.toString()}`;
}

export function activeChainId(): number {
  return publicChainId();
}

export { chainMode };
