// apps/web/src/lib/utils/bytea.ts
import { bytesToHex, hexToBytes, type Hex } from "viem";

export function hexToByteaLiteral(hex: Hex): string {
  return `\\x${hex.slice(2).toLowerCase()}`;
}

export function byteaToHex(value: unknown): Hex {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("\\x") || trimmed.startsWith("\\X")) {
      return `0x${trimmed.slice(2).toLowerCase()}`;
    }
    if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
      return `0x${trimmed.slice(2).toLowerCase()}`;
    }
    return `0x${trimmed.toLowerCase()}`;
  }
  if (value instanceof Uint8Array) {
    return bytesToHex(value);
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    Array.isArray((value as { data: unknown }).data)
  ) {
    return bytesToHex(Uint8Array.from((value as { data: number[] }).data));
  }
  throw new Error("unsupported bytea encoding");
}

export function assertBytes32(hex: Hex): Hex {
  const bytes = hexToBytes(hex);
  if (bytes.length !== 32) {
    throw new Error("expected 32-byte value");
  }
  return hex;
}
