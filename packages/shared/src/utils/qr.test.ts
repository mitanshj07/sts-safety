import { describe, expect, it } from "vitest"
import { parseCredentialQr } from "./qr"

describe("parseCredentialQr", () => {
  it("reads a public STS ID payload without an on-chain token", () => {
    const ref = parseCredentialQr(
      JSON.stringify({
        v: 1,
        kind: "sts-id",
        chainId: 80002,
        contract: "0xabc",
        tokenId: null,
        digitalId: "55555555-5555-4555-8555-555555555501",
        touristId: "22222222-2222-4222-8222-222222222201",
      }),
    )
    expect(ref?.digitalId).toBe("55555555-5555-4555-8555-555555555501")
    expect(ref?.touristId).toBe("22222222-2222-4222-8222-222222222201")
    expect(ref?.tokenId).toBeNull()
  })

  it("treats a bare UUID as a digital id", () => {
    const ref = parseCredentialQr("55555555-5555-4555-8555-555555555501")
    expect(ref?.digitalId).toBe("55555555-5555-4555-8555-555555555501")
    expect(ref?.tokenId).toBeNull()
  })

  it("reads numeric token ids and verify URLs", () => {
    expect(parseCredentialQr("42")?.tokenId).toBe("42")
    const fromUrl = parseCredentialQr(
      "https://sts-safety.vercel.app/verify?digitalId=55555555-5555-4555-8555-555555555501",
    )
    expect(fromUrl?.digitalId).toBe("55555555-5555-4555-8555-555555555501")
  })

  it("extracts a UUID from pasted ID card text", () => {
    const ref = parseCredentialQr("ID 55555555-5555-4555-8555-555555555501")
    expect(ref?.digitalId).toBe("55555555-5555-4555-8555-555555555501")
  })
})
