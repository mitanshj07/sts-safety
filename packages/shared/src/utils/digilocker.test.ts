import { describe, expect, it } from "vitest"
import { isValidAadhaar } from "./kyc"
import {
  DEMO_DIGILOCKER_AADHAAR,
  DEMO_DIGILOCKER_PROFILE,
  DEMO_EAADHAAR_XML,
  issuedItemToKyc,
  mapIssuedDocuments,
  parseDigilockerDob,
  parseEAadhaarXml,
} from "./digilocker"

describe("parseDigilockerDob", () => {
  it("normalises DigiLocker and eAadhaar date shapes to ISO", () => {
    expect(parseDigilockerDob("12041998")).toBe("1998-04-12")
    expect(parseDigilockerDob("12-04-1998")).toBe("1998-04-12")
    expect(parseDigilockerDob("12/04/1998")).toBe("1998-04-12")
    expect(parseDigilockerDob("1998-04-12")).toBe("1998-04-12")
    expect(parseDigilockerDob("")).toBeNull()
  })
})

describe("parseEAadhaarXml", () => {
  it("reads uid, name, and DOB from OfflinePaperlessKyc XML", () => {
    expect(parseEAadhaarXml(DEMO_EAADHAAR_XML)).toEqual({
      uid: DEMO_DIGILOCKER_AADHAAR,
      name: "Priya Sharma",
      dateOfBirth: "1998-04-12",
    })
  })

  it("reads uid from a Certificate / KycRes wrapper", () => {
    const xml = `<?xml version="1.0"?>
      <Certificate><CertificateData><KycRes>
        <UidData uid="234123412346">
          <Poi name="Ananya Baruah" dob="03-11-1996" gender="F"/>
        </UidData>
      </KycRes></CertificateData></Certificate>`
    expect(parseEAadhaarXml(xml)).toEqual({
      uid: "234123412346",
      name: "Ananya Baruah",
      dateOfBirth: "1996-11-03",
    })
  })

  it("returns null when no 12-digit uid is present", () => {
    expect(parseEAadhaarXml("<UidData><Poi name='X'/></UidData>")).toBeNull()
  })
})

describe("issued documents", () => {
  it("maps Aadhaar, driving licence, and voter ID doctypes", () => {
    expect(issuedItemToKyc({ doctype: "ADHAR", description: "eAadhaar" })).toBe(
      "aadhaar",
    )
    expect(issuedItemToKyc({ doctype: "DRVLC", description: "Driving License" })).toBe(
      "driving_licence",
    )
    expect(issuedItemToKyc({ doctype: "EPIC", name: "Voter ID" })).toBe("voter_id")
    expect(issuedItemToKyc({ description: "Income Certificate" })).toBeNull()
  })

  it("dedupes by KYC type and keeps issuer labels", () => {
    const docs = mapIssuedDocuments([
      { doctype: "ADHAR", description: "eAadhaar", issuer: "UIDAI" },
      { doctype: "ADHAR", description: "Aadhaar card", issuer: "UIDAI" },
      { doctype: "DRVLC", name: "DL", issuer: "Assam RTO" },
    ])
    expect(docs.map((d) => d.kycType)).toEqual(["aadhaar", "driving_licence"])
    expect(docs[1]?.issuer).toBe("Assam RTO")
  })
})

describe("demo DigiLocker profile", () => {
  it("uses the Verhoeff-valid Priya Sharma Aadhaar used in the pitch", () => {
    expect(isValidAadhaar(DEMO_DIGILOCKER_AADHAAR)).toBe(true)
    expect(DEMO_DIGILOCKER_PROFILE.kycType).toBe("aadhaar")
    expect(DEMO_DIGILOCKER_PROFILE.kycNumber).toBe(DEMO_DIGILOCKER_AADHAAR)
    expect(DEMO_DIGILOCKER_PROFILE.dateOfBirth).toBe("1998-04-12")
  })
})
