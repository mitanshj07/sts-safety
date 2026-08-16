// apps/web/src/lib/identity/kyc.ts
import { KYC_TYPE_ORDINAL } from "@sts/shared";

export function kycTypeToUint8(value: string): number {
  if (value in KYC_TYPE_ORDINAL) {
    return KYC_TYPE_ORDINAL[value as keyof typeof KYC_TYPE_ORDINAL];
  }
  return 1;
}

export function kycLast4(normalised: string): string {
  return normalised.slice(-4);
}
