// apps/web/src/lib/chain/hd.ts
import "server-only";

import type { Address } from "viem";
import { mnemonicToAccount } from "viem/accounts";

import { touristHdMnemonic } from "@/lib/chain/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type DerivedTouristWallet = {
  hdIndex: number;
  address: Address;
};

export function derivationPath(hdIndex: number): `m/44'/60'/${string}` {
  return `m/44'/60'/0'/0/${hdIndex}`;
}

/** Address only — the derived private key never leaves this function. */
export function deriveTouristAddress(hdIndex: number): Address {
  const account = mnemonicToAccount(touristHdMnemonic(), {
    path: derivationPath(hdIndex),
  });
  return account.address;
}

export async function allocateHdIndex(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("allocate_hd_index");
  if (error || data === null || data === undefined) {
    throw new Error(error?.message ?? "allocate_hd_index failed");
  }
  const index = typeof data === "number" ? data : Number(data);
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("allocate_hd_index returned a non-integer");
  }
  return index;
}

export async function allocateTouristWallet(): Promise<DerivedTouristWallet> {
  const hdIndex = await allocateHdIndex();
  return { hdIndex, address: deriveTouristAddress(hdIndex) };
}
