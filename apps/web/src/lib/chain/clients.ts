// apps/web/src/lib/chain/clients.ts
import "server-only";

import {
  createPublicClient,
  createWalletClient,
  custom,
  fallback,
  http,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

import { anvilLocal, polygonAmoy } from "@sts/shared";

import {
  chainMode,
  isZeroHex,
  issuerPrivateKey,
  rpcUrls,
} from "@/lib/chain/env";

export class ChainDisabledError extends Error {
  readonly method: string;

  constructor(method = "write") {
    super(`CHAIN_MODE=disabled; skipped ${method}`);
    this.name = "ChainDisabledError";
    this.method = method;
  }
}

const HTTP_RETRY = 2;

function activeChain(): Chain {
  return chainMode() === "anvil-local" ? anvilLocal : polygonAmoy;
}

function liveTransport(): Transport {
  const [primary, fallback1, fallback2] = rpcUrls();
  return fallback([
    http(primary, { retryCount: HTTP_RETRY }),
    http(fallback1, { retryCount: HTTP_RETRY }),
    http(fallback2, { retryCount: HTTP_RETRY }),
  ]);
}

function disabledTransport(): Transport {
  return custom({
    async request({ method }) {
      if (method === "eth_chainId") {
        return "0x0";
      }
      if (method === "eth_blockNumber") {
        return "0x0";
      }
      if (method === "eth_gasPrice") {
        return "0x1";
      }
      if (method === "eth_getBalance" || method === "eth_getTransactionCount") {
        return "0x0";
      }
      if (method === "eth_call") {
        return "0x";
      }
      if (method === "eth_estimateGas") {
        return "0x5208";
      }
      throw new ChainDisabledError(method);
    },
  });
}

function transport(): Transport {
  return chainMode() === "disabled" ? disabledTransport() : liveTransport();
}

let cachedPublic: PublicClient | undefined;
let cachedWallet: WalletClient | undefined;
let cachedAccount: PrivateKeyAccount | null | undefined;

export function getPublicClient(): PublicClient {
  if (!cachedPublic) {
    cachedPublic = createPublicClient({
      chain: activeChain(),
      transport: transport(),
    });
  }
  return cachedPublic;
}

export function getIssuerAccount(): PrivateKeyAccount | null {
  if (cachedAccount !== undefined) {
    return cachedAccount;
  }
  if (chainMode() === "disabled") {
    cachedAccount = null;
    try {
      const key = issuerPrivateKey();
      if (!isZeroHex(key)) {
        cachedAccount = privateKeyToAccount(key);
      }
    } catch {
      cachedAccount = null;
    }
    return cachedAccount;
  }
  try {
    const key = issuerPrivateKey();
    if (isZeroHex(key)) {
      cachedAccount = null;
      return cachedAccount;
    }
    cachedAccount = privateKeyToAccount(key);
  } catch {
    cachedAccount = null;
  }
  return cachedAccount;
}

export function getWalletClient(): WalletClient {
  if (!cachedWallet) {
    const account = getIssuerAccount();
    cachedWallet = createWalletClient({
      chain: activeChain(),
      transport: transport(),
      ...(account ? { account } : {}),
    });
  }
  return cachedWallet;
}

/** Exported clients — no-op stubs when CHAIN_MODE=disabled. */
export const publicClient: PublicClient = new Proxy({} as PublicClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPublicClient(), prop, receiver);
  },
}) as PublicClient;

export const walletClient: WalletClient = new Proxy({} as WalletClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getWalletClient(), prop, receiver);
  },
}) as WalletClient;

export function isChainWriteEnabled(): boolean {
  return chainMode() !== "disabled" && getIssuerAccount() !== null;
}

export type TxWaitResult = {
  txHash: Hex;
  blockNumber: bigint;
};

export async function writeSimulated(request: object): Promise<TxWaitResult> {
  if (!isChainWriteEnabled()) {
    throw new ChainDisabledError("writeContract");
  }
  const publicClient = getPublicClient();
  const wallet = getWalletClient();
  const estimateArgs =
    request as unknown as Parameters<PublicClient["estimateContractGas"]>[0];
  const gas = await publicClient.estimateContractGas(estimateArgs);
  const writeArgs = {
    ...(request as unknown as Record<string, unknown>),
    gas: (gas * BigInt(12)) / BigInt(10),
  } as Parameters<WalletClient["writeContract"]>[0];
  const hash = await wallet.writeContract(writeArgs);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash, blockNumber: receipt.blockNumber };
}
