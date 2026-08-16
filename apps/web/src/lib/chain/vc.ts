// apps/web/src/lib/chain/vc.ts
import "server-only";

import {
  recoverTypedDataAddress,
  sha256,
  stringToHex,
  verifyTypedData,
  type Address,
  type Hex,
} from "viem";

import type { VerifiableCredential } from "@sts/shared";

import { getIssuerAccount } from "@/lib/chain/clients";
import { activeChainId, registryAddress } from "@/lib/chain/config";
import { issuerAddress } from "@/lib/chain/env";

export const VC_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  TouristDigitalIdentity: [
    { name: "id", type: "string" },
    { name: "tokenId", type: "uint256" },
    { name: "holder", type: "address" },
    { name: "kycCommitment", type: "bytes32" },
    { name: "itineraryHash", type: "bytes32" },
    { name: "validFrom", type: "uint64" },
    { name: "validUntil", type: "uint64" },
    { name: "kycType", type: "uint8" },
    { name: "nationality", type: "string" },
  ],
} as const;

export type VcSubjectInput = {
  id: string;
  tokenId: bigint;
  holder: Address;
  kycCommitment: Hex;
  itineraryHash: Hex;
  validFrom: bigint;
  validUntil: bigint;
  kycType: number;
  nationality: string;
};

function domain(chainId: number, verifyingContract: Address) {
  return {
    name: "TouristDigitalIdentity",
    version: "1",
    chainId: BigInt(chainId),
    verifyingContract,
  } as const;
}

function messageFromSubject(subject: VcSubjectInput) {
  return {
    id: subject.id,
    tokenId: subject.tokenId,
    holder: subject.holder,
    kycCommitment: subject.kycCommitment,
    itineraryHash: subject.itineraryHash,
    validFrom: subject.validFrom,
    validUntil: subject.validUntil,
    kycType: subject.kycType,
    nationality: subject.nationality,
  };
}

export async function buildAndSignVc(
  subject: VcSubjectInput,
): Promise<{ vc: VerifiableCredential; sha256hex: Hex }> {
  const account = getIssuerAccount();
  if (!account) {
    throw new Error("issuer account unavailable; cannot sign VC");
  }
  const chainId = activeChainId();
  const verifyingContract = registryAddress();
  const typedDomain = domain(chainId, verifyingContract);
  const message = messageFromSubject(subject);
  const signature = await account.signTypedData({
    domain: typedDomain,
    types: { TouristDigitalIdentity: VC_TYPES.TouristDigitalIdentity },
    primaryType: "TouristDigitalIdentity",
    message,
  });
  const issuanceDate = new Date().toISOString();
  const vc: VerifiableCredential = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    type: ["VerifiableCredential", "TouristDigitalIdentity"],
    issuer: `did:ethr:${chainId}:${account.address}`,
    issuanceDate,
    credentialSubject: {
      id: `did:ethr:${chainId}:${subject.holder}`,
      tokenId: subject.tokenId.toString(),
      holder: subject.holder,
      kycCommitment: subject.kycCommitment,
      itineraryHash: subject.itineraryHash,
      kycType: subject.kycType,
      nationality: subject.nationality,
      validFrom: Number(subject.validFrom),
      validUntil: Number(subject.validUntil),
    },
    proof: {
      type: "EthereumEip712Signature2021",
      created: issuanceDate,
      proofPurpose: "assertionMethod",
      verificationMethod: account.address,
      proofValue: signature,
      eip712: {
        domain: {
          name: typedDomain.name,
          version: typedDomain.version,
          chainId: chainId,
          verifyingContract,
        },
        types: {
          TouristDigitalIdentity: [...VC_TYPES.TouristDigitalIdentity],
        },
        primaryType: "TouristDigitalIdentity",
        message: {
          id: subject.id,
          tokenId: subject.tokenId.toString(),
          holder: subject.holder,
          kycCommitment: subject.kycCommitment,
          itineraryHash: subject.itineraryHash,
          validFrom: Number(subject.validFrom),
          validUntil: Number(subject.validUntil),
          kycType: subject.kycType,
          nationality: subject.nationality,
        },
      },
    },
  };
  const serialized = JSON.stringify(vc);
  return { vc, sha256hex: sha256(stringToHex(serialized)) };
}

export async function verifyPresentedVc(
  vc: VerifiableCredential,
): Promise<{ ok: boolean; recovered: Address | null }> {
  const eip712 = vc.proof.eip712;
  if (!eip712) {
    return { ok: false, recovered: null };
  }
  const chainId = Number(eip712.domain["chainId"] ?? activeChainId());
  const verifyingContract = String(
    eip712.domain["verifyingContract"] ?? registryAddress(),
  ) as Address;
  const typedDomain = domain(chainId, verifyingContract);
  const subject = vc.credentialSubject;
  const message = {
    id: subject.id,
    tokenId: BigInt(subject.tokenId),
    holder: (subject.holder ?? "0x0000000000000000000000000000000000000000") as Address,
    kycCommitment: subject.kycCommitment as Hex,
    itineraryHash: (subject.itineraryHash ??
      "0x0000000000000000000000000000000000000000000000000000000000000000") as Hex,
    validFrom: BigInt(subject.validFrom ?? 0),
    validUntil: BigInt(subject.validUntil ?? 0),
    kycType: subject.kycType ?? 0,
    nationality: subject.nationality ?? "",
  };
  const expectedIssuer = getIssuerAccount()?.address ?? issuerAddress();
  try {
    const ok = await verifyTypedData({
      address: (vc.proof.verificationMethod || expectedIssuer) as Address,
      domain: typedDomain,
      types: { TouristDigitalIdentity: VC_TYPES.TouristDigitalIdentity },
      primaryType: "TouristDigitalIdentity",
      message,
      signature: vc.proof.proofValue as Hex,
    });
    const recovered = await recoverTypedDataAddress({
      domain: typedDomain,
      types: { TouristDigitalIdentity: VC_TYPES.TouristDigitalIdentity },
      primaryType: "TouristDigitalIdentity",
      message,
      signature: vc.proof.proofValue as Hex,
    });
    return { ok, recovered };
  } catch {
    return { ok: false, recovered: null };
  }
}
