// packages/shared/src/utils/kyc.ts
// Issuance policy: Indian travellers verify with Aadhaar (Voter ID / DL as
// equivalent Indian KYC). International travellers verify with a passport.
import type { KycType } from "../schemas/enums"
import { normaliseKycNumber } from "./hash"

export const INDIAN_KYC_TYPES = [
  "aadhaar",
  "voter_id",
  "driving_licence",
] as const satisfies readonly KycType[]

export const INTERNATIONAL_KYC_TYPES = ["passport"] as const satisfies readonly KycType[]

export const KYC_TYPE_LABELS: Record<KycType, string> = {
  passport: "Passport",
  aadhaar: "Aadhaar",
  voter_id: "Voter ID",
  driving_licence: "Driving licence",
}

export const KYC_NUMBER_HINTS: Record<KycType, string> = {
  aadhaar: "12-digit Aadhaar. Spaces are fine — never stored on-chain.",
  passport: "Machine-readable passport number (ICAO 9303, 6–9 characters).",
  voter_id: "EPIC voter ID — 3 letters followed by 7 digits.",
  driving_licence: "Indian driving licence — 2-letter state code + 13 digits.",
}

export const KYC_NUMBER_PLACEHOLDERS: Record<KycType, string> = {
  aadhaar: "2341 2341 2346",
  passport: "M1234567",
  voter_id: "ABC1234567",
  driving_licence: "AS0120150001234",
}

/** Verhoeff multiplication table. */
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
] as const

/** Verhoeff permutation table. */
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
] as const

const VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9] as const

export function isIndianNationality(nationality: string): boolean {
  return nationality.trim().toUpperCase() === "IN"
}

export function allowedKycTypes(nationality: string): readonly KycType[] {
  return isIndianNationality(nationality) ? INDIAN_KYC_TYPES : INTERNATIONAL_KYC_TYPES
}

export function defaultKycType(nationality: string): KycType {
  return isIndianNationality(nationality) ? "aadhaar" : "passport"
}

export function kycTypeAllowedForNationality(
  nationality: string,
  kycType: KycType,
): boolean {
  return (allowedKycTypes(nationality) as readonly string[]).includes(kycType)
}

function verhoeffChecksum(digits: string): number {
  let c = 0
  for (let i = 0; i < digits.length; i++) {
    const n = digits.charCodeAt(digits.length - 1 - i) - 48
    const permRow = VERHOEFF_P[i % 8]
    const mulRow = VERHOEFF_D[c]
    const permuted = permRow?.[n]
    const next = permuted === undefined ? undefined : mulRow?.[permuted]
    if (next === undefined) {
      throw new TypeError("verhoeff table lookup failed")
    }
    c = next
  }
  return c
}

/** True when `digits` (including check digit) is a valid Verhoeff string. */
export function verhoeffValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false
  return verhoeffChecksum(digits) === 0
}

/** Check digit that makes `body + digit` Verhoeff-valid. */
export function verhoeffCheckDigit(body: string): string {
  if (!/^\d+$/.test(body)) {
    throw new TypeError("verhoeffCheckDigit expects decimal digits")
  }
  const c = verhoeffChecksum(`${body}0`)
  const digit = VERHOEFF_INV[c]
  if (digit === undefined) {
    throw new TypeError("verhoeff inverse lookup failed")
  }
  return String(digit)
}

/**
 * UIDAI rules used at onboarding: 12 digits, first digit 2–9, Verhoeff checksum.
 * Hyphens and spaces are stripped first.
 */
export function isValidAadhaar(kycNumber: string): boolean {
  const n = normaliseKycNumber(kycNumber)
  if (!/^[2-9]\d{11}$/.test(n)) return false
  return verhoeffValid(n)
}

/** ICAO 9303-style travel document number: letter + 5–8 alphanumerics. */
export function isValidPassportNumber(kycNumber: string): boolean {
  const n = normaliseKycNumber(kycNumber)
  return /^[A-Z][A-Z0-9]{5,8}$/.test(n)
}

/** Election Commission EPIC: 3 letters + 7 digits. */
export function isValidVoterId(kycNumber: string): boolean {
  const n = normaliseKycNumber(kycNumber)
  return /^[A-Z]{3}\d{7}$/.test(n)
}

/** Indian driving licence after 2016: 2-letter state code + 13 digits (15 chars). */
export function isValidDrivingLicence(kycNumber: string): boolean {
  const n = normaliseKycNumber(kycNumber)
  return /^[A-Z]{2}\d{13}$/.test(n)
}

export function isValidKycNumber(kycType: KycType, kycNumber: string): boolean {
  switch (kycType) {
    case "aadhaar":
      return isValidAadhaar(kycNumber)
    case "passport":
      return isValidPassportNumber(kycNumber)
    case "voter_id":
      return isValidVoterId(kycNumber)
    case "driving_licence":
      return isValidDrivingLicence(kycNumber)
  }
}

export function kycNumberError(kycType: KycType): string {
  switch (kycType) {
    case "aadhaar":
      return "Enter a 12-digit Aadhaar number (first digit 2–9, valid checksum)."
    case "passport":
      return "Enter a passport number (letter plus 5–8 letters or digits)."
    case "voter_id":
      return "Enter a Voter ID / EPIC (3 letters + 7 digits, e.g. ABC1234567)."
    case "driving_licence":
      return "Enter an Indian driving licence (state code + 13 digits)."
  }
}

export type KycIssuanceIssue = {
  path: "kycType" | "kycNumber" | "nationality"
  message: string
}

export function kycIssuanceIssues(input: {
  nationality: string
  kycType: KycType
  kycNumber: string
}): KycIssuanceIssue[] {
  const issues: KycIssuanceIssue[] = []
  const nationality = input.nationality.trim().toUpperCase()
  if (nationality.length !== 2) {
    issues.push({
      path: "nationality",
      message: "Nationality must be an ISO 3166-1 alpha-2 code.",
    })
    return issues
  }
  if (!kycTypeAllowedForNationality(nationality, input.kycType)) {
    issues.push({
      path: "kycType",
      message: isIndianNationality(nationality)
        ? "Indian travellers must verify with Aadhaar (Voter ID or driving licence also accepted)."
        : "International travellers must verify with a passport.",
    })
  }
  if (!isValidKycNumber(input.kycType, input.kycNumber)) {
    issues.push({
      path: "kycNumber",
      message: kycNumberError(input.kycType),
    })
  }
  return issues
}

/** Deterministic 12-digit Verhoeff-valid Aadhaar-shaped guest number. */
export function guestAadhaarNumber(seed: string): string {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const unsigned = hash >>> 0
  const body = `2${String(unsigned).padStart(10, "0")}`.slice(0, 11)
  return `${body}${verhoeffCheckDigit(body)}`
}

/** ICAO-shaped guest passport derived from a profile id or display name. */
export function guestPassportNumber(seed: string): string {
  const compact = seed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().padEnd(7, "0")
  return `G${compact.slice(0, 7)}`
}

export function guestKycForNationality(
  nationality: string,
  seed: string,
): { kycType: KycType; kycNumber: string } {
  if (isIndianNationality(nationality)) {
    return { kycType: "aadhaar", kycNumber: guestAadhaarNumber(seed) }
  }
  return { kycType: "passport", kycNumber: guestPassportNumber(seed) }
}
