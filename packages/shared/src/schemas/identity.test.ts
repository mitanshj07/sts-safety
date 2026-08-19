import { describe, expect, it } from "vitest"
import { issueIdentityRequestSchema } from "./identity"
import { verhoeffCheckDigit } from "../utils/kyc"

const aadhaar = `23412341234${verhoeffCheckDigit("23412341234")}`

const base = {
  name: "Priya Sharma",
  dateOfBirth: "1998-04-12",
  phone: "+919800000001",
  tripStart: "2026-08-19T00:00:00.000Z",
  tripEnd: "2026-08-26T00:00:00.000Z",
}

describe("issueIdentityRequestSchema KYC policy", () => {
  it("accepts Indian Aadhaar at issuance", () => {
    const parsed = issueIdentityRequestSchema.safeParse({
      ...base,
      kycType: "aadhaar",
      kycNumber: aadhaar,
      nationality: "IN",
    })
    expect(parsed.success).toBe(true)
  })

  it("rejects Indian passport at issuance", () => {
    const parsed = issueIdentityRequestSchema.safeParse({
      ...base,
      kycType: "passport",
      kycNumber: "M1234567",
      nationality: "IN",
    })
    expect(parsed.success).toBe(false)
  })

  it("accepts international passport at issuance", () => {
    const parsed = issueIdentityRequestSchema.safeParse({
      ...base,
      kycType: "passport",
      kycNumber: "GB7654321",
      nationality: "GB",
    })
    expect(parsed.success).toBe(true)
  })

  it("rejects international Aadhaar at issuance", () => {
    const parsed = issueIdentityRequestSchema.safeParse({
      ...base,
      kycType: "aadhaar",
      kycNumber: aadhaar,
      nationality: "JP",
    })
    expect(parsed.success).toBe(false)
  })
})
