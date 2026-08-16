// apps/web/src/lib/chain/registry.ts
import "server-only";

import { padHex, stringToHex, type Address, type Hex } from "viem";

import { touristIdentityRegistryAbi } from "@/lib/chain/abi/TouristIdentityRegistry";
import {
  ChainDisabledError,
  getIssuerAccount,
  getPublicClient,
  writeSimulated,
  type TxWaitResult,
} from "@/lib/chain/clients";
import { registryAddress } from "@/lib/chain/config";

export type IssueArgs = {
  to: Address;
  kycCommitment: Hex;
  itineraryHash: Hex;
  validFrom: bigint;
  validUntil: bigint;
  kycType: number;
  nationality: Hex;
  metadataURI: string;
};

export type OnChainVerify = {
  valid: boolean;
  status: number;
  validUntil: bigint;
  commitment: Hex;
};

export function reasonToBytes32(reason: string): Hex {
  return padHex(stringToHex(reason.slice(0, 32)), { size: 32, dir: "right" });
}

export function nationalityToBytes2(iso2: string): Hex {
  return stringToHex(iso2.slice(0, 2).toUpperCase().padEnd(2, "X"), {
    size: 2,
  });
}

export async function issueIdentity(args: IssueArgs): Promise<{
  tokenId: bigint;
} & TxWaitResult> {
  const account = getIssuerAccount();
  if (!account) {
    throw new ChainDisabledError("issue");
  }
  const publicClient = getPublicClient();
  const { request, result } = await publicClient.simulateContract({
    account,
    address: registryAddress(),
    abi: touristIdentityRegistryAbi,
    functionName: "issue",
    args: [
      args.to,
      args.kycCommitment,
      args.itineraryHash,
      args.validFrom,
      args.validUntil,
      args.kycType,
      args.nationality,
      args.metadataURI,
    ],
  });
  const waited = await writeSimulated(request);
  return { tokenId: result, ...waited };
}

export async function revokeIdentity(
  tokenId: bigint,
  reason: string,
): Promise<TxWaitResult> {
  const account = getIssuerAccount();
  if (!account) {
    throw new ChainDisabledError("revoke");
  }
  const publicClient = getPublicClient();
  const { request } = await publicClient.simulateContract({
    account,
    address: registryAddress(),
    abi: touristIdentityRegistryAbi,
    functionName: "revoke",
    args: [tokenId, reasonToBytes32(reason)],
  });
  return writeSimulated(request);
}

export async function extendValidity(
  tokenId: bigint,
  newValidUntil: bigint,
): Promise<TxWaitResult> {
  const account = getIssuerAccount();
  if (!account) {
    throw new ChainDisabledError("extendValidity");
  }
  const publicClient = getPublicClient();
  const { request } = await publicClient.simulateContract({
    account,
    address: registryAddress(),
    abi: touristIdentityRegistryAbi,
    functionName: "extendValidity",
    args: [tokenId, newValidUntil],
  });
  return writeSimulated(request);
}

export async function updateItinerary(
  tokenId: bigint,
  newItineraryHash: Hex,
): Promise<TxWaitResult> {
  const account = getIssuerAccount();
  if (!account) {
    throw new ChainDisabledError("updateItinerary");
  }
  const publicClient = getPublicClient();
  const { request } = await publicClient.simulateContract({
    account,
    address: registryAddress(),
    abi: touristIdentityRegistryAbi,
    functionName: "updateItinerary",
    args: [tokenId, newItineraryHash],
  });
  return writeSimulated(request);
}

export async function verifyIdentity(tokenId: bigint): Promise<OnChainVerify> {
  const publicClient = getPublicClient();
  const [valid, status, validUntil, commitment] = await publicClient.readContract({
    address: registryAddress(),
    abi: touristIdentityRegistryAbi,
    functionName: "verify",
    args: [tokenId],
  });
  return { valid, status, validUntil, commitment };
}

export async function verifyKycOnChain(args: {
  tokenId: bigint;
  kycType: number;
  kycNumber: string;
  salt: Hex;
}): Promise<boolean> {
  const publicClient = getPublicClient();
  return publicClient.readContract({
    address: registryAddress(),
    abi: touristIdentityRegistryAbi,
    functionName: "verifyKyc",
    args: [args.tokenId, args.kycType, args.kycNumber, args.salt],
  });
}

export async function ownerOf(tokenId: bigint): Promise<Address> {
  const publicClient = getPublicClient();
  return publicClient.readContract({
    address: registryAddress(),
    abi: touristIdentityRegistryAbi,
    functionName: "ownerOf",
    args: [tokenId],
  });
}

export async function tokenURI(tokenId: bigint): Promise<string> {
  const publicClient = getPublicClient();
  return publicClient.readContract({
    address: registryAddress(),
    abi: touristIdentityRegistryAbi,
    functionName: "tokenURI",
    args: [tokenId],
  });
}
