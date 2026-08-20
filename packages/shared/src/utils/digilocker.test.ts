import { describe, expect, it } from "vitest"
import { isValidAadhaar } from "./kyc"
import {
  DEMO_DIGILOCKER_AADHAAR,
  DEMO_DIGILOCKER_PROFILE,
  DEMO_EAADHAAR_XML,
  extractIssuedItems,
  issuedItemHasXml,
  issuedItemToKyc,
  mapIssuedDocuments,
  parseDigilockerDob,
  parseDigilockerUserFields,
  parseDrivingLicenceXml,
  parseEAadhaarXml,
  parseEpicXml,
  parseIssuedCertificateXml,
  resolveDigilockerKyc,
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
    expect(issuedItemToKyc({ doctype: "PASSP", description: "Passport" })).toBe(
      "passport",
    )
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

describe("issued certificate XML", () => {
  it("reads a driving licence number from DigiLocker certificate XML", () => {
    const xml = `<?xml version="1.0"?>
      <Certificate>
        <CertificateData>
          <DrivingLicence dlno="AS0120150001234">
            <IssuedTo><Person name="Priya Sharma" dob="12-04-1998"/></IssuedTo>
          </DrivingLicence>
        </CertificateData>
      </Certificate>`
    expect(parseDrivingLicenceXml(xml)).toEqual({
      number: "AS0120150001234",
      name: "Priya Sharma",
      dateOfBirth: "1998-04-12",
    })
  })

  it("reads an EPIC from voter XML", () => {
    const xml = `<Certificate><CertificateData><epicno>ABC1234567</epicno><Person name="Ananya Baruah" dob="03-11-1996"/></CertificateData></Certificate>`
    expect(parseEpicXml(xml)?.number).toBe("ABC1234567")
  })

  it("extracts issued items from the partner list payload", () => {
    const items = extractIssuedItems({
      items: [
        { doctype: "ADHAR", uri: "in.gov.uidai-ADHAR-1", mime: "application/xml" },
        { doctype: "DRVLC", uri: "in.gov.transport-DRVLC-1", mime: [{ "application/xml": true }] },
      ],
    })
    expect(items).toHaveLength(2)
    expect(issuedItemHasXml(items[0]!)).toBe(true)
    expect(issuedItemHasXml(items[1]!)).toBe(true)
  })

  it("extracts items from the nested { item: [] } list shape", () => {
    const items = extractIssuedItems({
      items: {
        item: [{ doctype: "EPIC", uri: "in.gov.eci-EPIC-1" }],
      },
    })
    expect(items).toHaveLength(1)
    expect(issuedItemToKyc(items[0]!)).toBe("voter_id")
  })

  it("parses issued XML by KYC type", () => {
    expect(parseIssuedCertificateXml(DEMO_EAADHAAR_XML, "aadhaar")?.number).toBe(
      DEMO_DIGILOCKER_AADHAAR,
    )
  })
})

describe("token / user payload", () => {
  it("reads name, compact DOB, eAadhaar flag, and digilockerid from the token JSON", () => {
    expect(
      parseDigilockerUserFields({
        name: "Ananya Baruah",
        dob: "03111996",
        eaadhaar: "Y",
        digilockerid: "dl-ananya",
      }),
    ).toEqual({
      name: "Ananya Baruah",
      dateOfBirth: "1996-11-03",
      eaadhaarLinked: true,
      digilockerId: "dl-ananya",
    })
  })
})

describe("resolveDigilockerKyc", () => {
  it("prefers eAadhaar over issued driving licence", () => {
    const resolved = resolveDigilockerKyc({
      name: "Token Name",
      dateOfBirth: "1998-01-01",
      eaadhaar: {
        uid: DEMO_DIGILOCKER_AADHAAR,
        name: "Priya Sharma",
        dateOfBirth: "1998-04-12",
      },
      certificates: [
        {
          kycType: "driving_licence",
          number: "AS0120150001234",
          name: "Priya Sharma",
          dateOfBirth: "1998-04-12",
        },
      ],
    })
    expect(resolved).toEqual({
      name: "Priya Sharma",
      dateOfBirth: "1998-04-12",
      kycType: "aadhaar",
      kycNumber: DEMO_DIGILOCKER_AADHAAR,
    })
  })

  it("falls back to driving licence when eAadhaar is missing", () => {
    const resolved = resolveDigilockerKyc({
      name: "Priya Sharma",
      dateOfBirth: "1998-04-12",
      eaadhaar: null,
      certificates: [
        {
          kycType: "driving_licence",
          number: "AS0120150001234",
          name: null,
          dateOfBirth: null,
        },
      ],
    })
    expect(resolved?.kycType).toBe("driving_licence")
    expect(resolved?.kycNumber).toBe("AS0120150001234")
    expect(resolved?.name).toBe("Priya Sharma")
  })

  it("does not use passport as Indian DigiLocker KYC", () => {
    expect(
      resolveDigilockerKyc({
        name: "Alex Reed",
        dateOfBirth: "1990-01-02",
        eaadhaar: null,
        certificates: [
          {
            kycType: "passport",
            number: "A1234567",
            name: "Alex Reed",
            dateOfBirth: "1990-01-02",
          },
        ],
      }),
    ).toBeNull()
  })
})

describe("demo profile", () => {
  it("uses the Verhoeff-valid Priya Sharma Aadhaar used in the pitch", () => {
    expect(isValidAadhaar(DEMO_DIGILOCKER_AADHAAR)).toBe(true)
    expect(DEMO_DIGILOCKER_PROFILE.kycType).toBe("aadhaar")
    expect(DEMO_DIGILOCKER_PROFILE.kycNumber).toBe(DEMO_DIGILOCKER_AADHAAR)
    expect(DEMO_DIGILOCKER_PROFILE.dateOfBirth).toBe("1998-04-12")
  })
})
