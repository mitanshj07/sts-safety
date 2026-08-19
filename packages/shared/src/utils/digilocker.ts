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
  const blob = [item.doctype, item.description, item.name, item.issuer]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()
  if (/AADHA|ADHAR|EAADH|UIDAI/.test(blob)) return "aadhaar"
  if (/DRVLC|DRLIC|DRIVING/.test(blob)) return "driving_licence"
  if (/\bEPIC\b|VOTER|NOPER|ELECTOR/.test(blob)) return "voter_id"
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
    "DigiLocker did not share eAadhaar. Link Aadhaar in DigiLocker, or enter the number below.",
  fetch: "Could not fetch DigiLocker documents. Try again, or enter Aadhaar below.",
  config: "DigiLocker live credentials are missing. Demo mode needs DIGILOCKER_MODE=demo.",
} as const

export type DigilockerReasonCode = keyof typeof DIGILOCKER_REASON_COPY
