// packages/shared/src/utils/digilocker.ts
// DigiLocker requester helpers: eAadhaar XML, issued-doc mapping, demo profile.
import type { KycType } from "../schemas/enums"
import { KYC_TYPE_LABELS } from "./kyc"

export const DEMO_DIGILOCKER_CODE = "demo"
export const DEMO_DIGILOCKER_AADHAAR = "234123412346"

export type DigilockerIssuedItem = {
  name?: string
  doctype?: string
  description?: string
  issuer?: string
  issuerid?: string
  uri?: string
  mime?: unknown
  type?: string
}

type MappedDocument = {
  kycType: KycType
  label: string
  issuer: string
  doctype: string
}

export type DigilockerFetchedProfile = {
  name: string
  dateOfBirth: string | null
  kycType: KycType
  kycNumber: string
  documents: MappedDocument[]
  digilockerId: string
}

const UID_ATTR = /\buid=["'](\d{12})["']/i
const UID_TAG = /<Uid>(\d{12})<\/Uid>/i
const POI_NAME = /\bname=["']([^"']+)["']/i
const POI_DOB = /\bdob=["']([^"']+)["']/i
const POI_BLOCK = /<Poi\b([^>]*)>/i

export function parseDigilockerDob(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dashed = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dashed) return `${dashed[3]}-${dashed[2]}-${dashed[1]}`
  const slashed = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (slashed) return `${slashed[3]}-${slashed[2]}-${slashed[1]}`
  const compact = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/)
  if (compact) return `${compact[3]}-${compact[2]}-${compact[1]}`
  return null
}

export function parseEAadhaarXml(xml: string): {
  uid: string
  name: string | null
  dateOfBirth: string | null
} | null {
  const uid = xml.match(UID_ATTR)?.[1] ?? xml.match(UID_TAG)?.[1]
  if (!uid) return null
  const poi = xml.match(POI_BLOCK)?.[1] ?? xml
  const name = poi.match(POI_NAME)?.[1]?.trim() ?? null
  const dateOfBirth = parseDigilockerDob(poi.match(POI_DOB)?.[1] ?? null)
  return { uid, name, dateOfBirth }
}

export function issuedItemToKyc(item: DigilockerIssuedItem): KycType | null {
  const blob = [item.doctype, item.description, item.name, item.issuer, item.uri]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()
  if (/AADHA|ADHAR|EAADH|UIDAI/.test(blob)) return "aadhaar"
  if (/DRVLC|DRLIC|DRIVING/.test(blob)) return "driving_licence"
  if (/\bEPIC\b|VOTER|NOPER|ELECTOR/.test(blob)) return "voter_id"
  if (/PASSP|PSPORT|PASSPORT/.test(blob)) return "passport"
  return null
}

export function mapIssuedDocuments(
  items: DigilockerIssuedItem[],
): MappedDocument[] {
  const seen = new Set<KycType>()
  const out: MappedDocument[] = []
  for (const item of items) {
    const kycType = issuedItemToKyc(item)
    if (!kycType || seen.has(kycType)) continue
    seen.add(kycType)
    out.push({
      kycType,
      label: item.description?.trim() || item.name?.trim() || KYC_TYPE_LABELS[kycType],
      issuer: item.issuer?.trim() || item.issuerid?.trim() || "DigiLocker",
      doctype: item.doctype?.trim() || "",
    })
  }
  return out
}

export function issuedItemHasXml(item: DigilockerIssuedItem): boolean {
  const mime = item.mime
  if (typeof mime === "string") return /xml/i.test(mime)
  if (Array.isArray(mime)) {
    return mime.some((entry) => {
      if (typeof entry === "string") return /xml/i.test(entry)
      if (entry && typeof entry === "object") {
        return Object.keys(entry as Record<string, unknown>).some((key) =>
          /xml/i.test(key),
        )
      }
      return false
    })
  }
  return Boolean(issuedItemToKyc(item))
}

export function extractIssuedItems(payload: unknown): DigilockerIssuedItem[] {
  if (!payload || typeof payload !== "object") return []
  const root = payload as Record<string, unknown>
  const raw = root.items ?? root.Items
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { item?: unknown }).item)
      ? (raw as { item: unknown[] }).item
      : []
  return list.filter((row): row is DigilockerIssuedItem => Boolean(row && typeof row === "object"))
}

const ATTR = (name: string) => new RegExp(`\\b${name}=["']([^"']+)["']`, "i")
const TAG = (name: string) => new RegExp(`<${name}[^>]*>([^<]+)</${name}>`, "i")

function firstMatch(xml: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const value = xml.match(pattern)?.[1]?.trim()
    if (value) return value
  }
  return null
}

export function parseDrivingLicenceXml(xml: string): {
  number: string
  name: string | null
  dateOfBirth: string | null
} | null {
  const number = firstMatch(xml, [
    ATTR("dlno"),
    ATTR("dlNo"),
    ATTR("licencenumber"),
    TAG("dlno"),
    TAG("DLNo"),
    TAG("LicenceNumber"),
    /DL[- ]?NO[:\s]*([A-Z]{2}[\s-]?\d{2}[\s-]?\d{4}[\s-]?\d{7})/i,
  ])
  if (!number) return null
  const name = firstMatch(xml, [POI_NAME, ATTR("fullname"), TAG("name")])
  const dateOfBirth = parseDigilockerDob(
    firstMatch(xml, [POI_DOB, ATTR("dob"), TAG("dob"), TAG("DateOfBirth")]),
  )
  return { number, name, dateOfBirth }
}

export function parseEpicXml(xml: string): {
  number: string
  name: string | null
  dateOfBirth: string | null
} | null {
  const number = firstMatch(xml, [
    ATTR("epic"),
    ATTR("epicno"),
    ATTR("epicNo"),
    TAG("epicno"),
    TAG("EPICNo"),
    TAG("EpicNo"),
    /\b([A-Z]{3}\d{7})\b/,
  ])
  if (!number) return null
  const name = firstMatch(xml, [POI_NAME, ATTR("fullname"), TAG("name")])
  const dateOfBirth = parseDigilockerDob(
    firstMatch(xml, [POI_DOB, ATTR("dob"), TAG("dob"), TAG("DateOfBirth")]),
  )
  return { number, name, dateOfBirth }
}

export function parsePassportXml(xml: string): {
  number: string
  name: string | null
  dateOfBirth: string | null
} | null {
  const number = firstMatch(xml, [
    ATTR("passportno"),
    ATTR("passportNo"),
    TAG("passportno"),
    TAG("PassportNo"),
    TAG("PassportNumber"),
  ])
  if (!number) return null
  const name = firstMatch(xml, [POI_NAME, ATTR("fullname"), TAG("name")])
  const dateOfBirth = parseDigilockerDob(
    firstMatch(xml, [POI_DOB, ATTR("dob"), TAG("dob"), TAG("DateOfBirth")]),
  )
  return { number, name, dateOfBirth }
}

export type DigilockerUserFields = {
  name: string
  dateOfBirth: string | null
  eaadhaarLinked: boolean
  digilockerId: string
}

function pickString(json: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = json[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

export function parseDigilockerUserFields(
  json: Record<string, unknown> | null | undefined,
): DigilockerUserFields {
  if (!json) {
    return { name: "", dateOfBirth: null, eaadhaarLinked: false, digilockerId: "" }
  }
  const ea = pickString(json, ["eaadhaar", "eAadhaar", "e_aadhaar"]).toUpperCase()
  return {
    name: pickString(json, ["name", "fullname", "full_name"]),
    dateOfBirth: parseDigilockerDob(
      pickString(json, ["dob", "dateofbirth", "date_of_birth"]),
    ),
    eaadhaarLinked: ea === "Y" || ea === "YES" || ea === "TRUE" || ea === "1",
    digilockerId: pickString(json, ["digilockerid", "digilockerId", "sub"]),
  }
}

export function mergeDigilockerUserFields(
  primary: DigilockerUserFields,
  fallback: DigilockerUserFields,
): DigilockerUserFields {
  return {
    name: primary.name || fallback.name,
    dateOfBirth: primary.dateOfBirth ?? fallback.dateOfBirth,
    eaadhaarLinked: primary.eaadhaarLinked || fallback.eaadhaarLinked,
    digilockerId: primary.digilockerId || fallback.digilockerId,
  }
}

export type DigilockerParsedCertificate = {
  kycType: KycType
  number: string
  name: string | null
  dateOfBirth: string | null
}

const DIGILOCKER_KYC_PRIORITY: KycType[] = [
  "aadhaar",
  "driving_licence",
  "voter_id",
]

export function resolveDigilockerKyc(args: {
  name: string
  dateOfBirth: string | null
  eaadhaar: { uid: string; name: string | null; dateOfBirth: string | null } | null
  certificates: DigilockerParsedCertificate[]
}): { name: string; dateOfBirth: string | null; kycType: KycType; kycNumber: string } | null {
  const byType = new Map<KycType, DigilockerParsedCertificate>()
  if (args.eaadhaar?.uid) {
    byType.set("aadhaar", {
      kycType: "aadhaar",
      number: args.eaadhaar.uid,
      name: args.eaadhaar.name,
      dateOfBirth: args.eaadhaar.dateOfBirth,
    })
  }
  for (const cert of args.certificates) {
    if (!cert.number || byType.has(cert.kycType)) continue
    byType.set(cert.kycType, cert)
  }
  for (const kycType of DIGILOCKER_KYC_PRIORITY) {
    const hit = byType.get(kycType)
    if (!hit) continue
    return {
      name: hit.name || args.name,
      dateOfBirth: hit.dateOfBirth ?? args.dateOfBirth,
      kycType,
      kycNumber: hit.number,
    }
  }
  return null
}

export function parseIssuedCertificateXml(
  xml: string,
  kycType: KycType,
): DigilockerParsedCertificate | null {
  if (kycType === "aadhaar") {
    const parsed = parseEAadhaarXml(xml)
    if (!parsed?.uid) return null
    return {
      kycType,
      number: parsed.uid,
      name: parsed.name,
      dateOfBirth: parsed.dateOfBirth,
    }
  }
  if (kycType === "driving_licence") {
    const parsed = parseDrivingLicenceXml(xml)
    if (!parsed) return null
    return { kycType, number: parsed.number, name: parsed.name, dateOfBirth: parsed.dateOfBirth }
  }
  if (kycType === "voter_id") {
    const parsed = parseEpicXml(xml)
    if (!parsed) return null
    return { kycType, number: parsed.number, name: parsed.name, dateOfBirth: parsed.dateOfBirth }
  }
  if (kycType === "passport") {
    const parsed = parsePassportXml(xml)
    if (!parsed) return null
    return { kycType, number: parsed.number, name: parsed.name, dateOfBirth: parsed.dateOfBirth }
  }
  return null
}

export const DEMO_DIGILOCKER_PROFILE: DigilockerFetchedProfile = {
  name: "Priya Sharma",
  dateOfBirth: "1998-04-12",
  kycType: "aadhaar",
  kycNumber: DEMO_DIGILOCKER_AADHAAR,
  digilockerId: "demo-priya-sharma",
  documents: [
    {
      kycType: "aadhaar",
      label: "eAadhaar",
      issuer: "UIDAI",
      doctype: "ADHAR",
    },
    {
      kycType: "driving_licence",
      label: "Driving Licence",
      issuer: "Transport Department, Assam",
      doctype: "DRVLC",
    },
    {
      kycType: "voter_id",
      label: "Voter ID (EPIC)",
      issuer: "Election Commission of India",
      doctype: "EPIC",
    },
  ],
}

export const DEMO_EAADHAAR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<OfflinePaperlessKyc>
  <UidData uid="${DEMO_DIGILOCKER_AADHAAR}">
    <Poi name="Priya Sharma" dob="12-04-1998" gender="F"/>
  </UidData>
</OfflinePaperlessKyc>
`

export const DIGILOCKER_REASON_COPY = {
  denied: "DigiLocker access was cancelled. Allow the request, or enter Aadhaar below.",
  state: "The DigiLocker session expired. Start again from Continue with DigiLocker.",
  hmac: "The eAadhaar file could not be verified. Enter the document number below.",
  missing_aadhaar:
    "DigiLocker did not share eAadhaar, a driving licence, or a voter ID. Link Aadhaar in DigiLocker, or enter the number below.",
  fetch: "Could not fetch DigiLocker documents from MeitY. Try again, or enter Aadhaar below.",
  config:
    "DigiLocker partner credentials are missing. Register a requester app at partners.digitallocker.gov.in, then set DIGILOCKER_CLIENT_ID and DIGILOCKER_CLIENT_SECRET.",
} as const

export type DigilockerReasonCode = keyof typeof DIGILOCKER_REASON_COPY
