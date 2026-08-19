import { describe, expect, it } from "vitest"
import {
  allowedKycTypes,
  defaultKycType,
  guestAadhaarNumber,
  guestKycForNationality,
  isValidAadhaar,
  isValidDrivingLicence,
  isValidPassportNumber,
  isValidVoterId,
  kycIssuanceIssues,
  kycTypeAllowedForNationality,
  verhoeffCheckDigit,
  verhoeffValid,
} from "./kyc"

describe("nationality → KYC type", () => {
  it("requires Aadhaar (or Voter ID / DL) for Indian travellers", () => {
    expect(defaultKycType("IN")).toBe("aadhaar")
    expect(defaultKycType("in")).toBe("aadhaar")
    expect([...allowedKycTypes("IN")]).toEqual([
      "aadhaar",
      "voter_id",
      "driving_licence",
    ])
    expect(kycTypeAllowedForNationality("IN", "passport")).toBe(false)
    expect(kycTypeAllowedForNationality("IN", "aadhaar")).toBe(true)
  })

  it("requires a passport for everyone else", () => {
    expect(defaultKycType("GB")).toBe("passport")
    expect(defaultKycType("JP")).toBe("passport")
    expect([...allowedKycTypes("US")]).toEqual(["passport"])
    expect(kycTypeAllowedForNationality("GB", "aadhaar")).toBe(false)
    expect(kycTypeAllowedForNationality("GB", "passport")).toBe(true)
  })
})

describe("document numbers", () => {
  it("accepts Verhoeff-valid Aadhaar and rejects bad checksums / leading 0-1", () => {
    expect(isValidAadhaar("234123412346")).toBe(true)
    expect(isValidAadhaar("2341 2341 2346")).toBe(true)
    expect(isValidAadhaar("123456789012")).toBe(false)
    expect(isValidAadhaar("234123412347")).toBe(false)
    expect(verhoeffValid("234123412346")).toBe(true)
  })

  it("accepts ICAO-style passports and EPIC / DL shapes", () => {
    expect(isValidPassportNumber("M1234567")).toBe(true)
    expect(isValidPassportNumber("gb-765 4321")).toBe(true)
    expect(isValidPassportNumber("12ABCDE")).toBe(false)
    expect(isValidVoterId("ABC1234567")).toBe(true)
    expect(isValidVoterId("AB1234567")).toBe(false)
    expect(isValidDrivingLicence("AS0120150001234")).toBe(true)
    expect(isValidDrivingLicence("AS012015000")).toBe(false)
  })
})

describe("kycIssuanceIssues", () => {
  const aadhaar = `23412341234${verhoeffCheckDigit("23412341234")}`

  it("blocks passport KYC for Indian nationality", () => {
    const issues = kycIssuanceIssues({
      nationality: "IN",
      kycType: "passport",
      kycNumber: "M1234567",
    })
    expect(issues.some((i) => i.path === "kycType")).toBe(true)
  })

  it("blocks Aadhaar KYC for international nationality", () => {
    const issues = kycIssuanceIssues({
      nationality: "GB",
      kycType: "aadhaar",
      kycNumber: aadhaar,
    })
    expect(issues.some((i) => i.path === "kycType")).toBe(true)
  })

  it("accepts a valid Indian Aadhaar issuance", () => {
    expect(
      kycIssuanceIssues({
        nationality: "IN",
        kycType: "aadhaar",
        kycNumber: aadhaar,
      }),
    ).toEqual([])
  })

  it("accepts a valid international passport issuance", () => {
    expect(
      kycIssuanceIssues({
        nationality: "JP",
        kycType: "passport",
        kycNumber: "TS7654321",
      }),
    ).toEqual([])
  })
})

describe("guest credentials", () => {
  it("mints a Verhoeff-valid Aadhaar for Indian skip-to-app", () => {
    const number = guestAadhaarNumber("profile-123")
    expect(isValidAadhaar(number)).toBe(true)
    expect(guestAadhaarNumber("profile-123")).toBe(number)
    expect(guestAadhaarNumber("other")).not.toBe(number)
  })

  it("mints an ICAO-shaped passport for international guests", () => {
    const { kycType, kycNumber } = guestKycForNationality("GB", "guest-1")
    expect(kycType).toBe("passport")
    expect(isValidPassportNumber(kycNumber)).toBe(true)
  })
})
