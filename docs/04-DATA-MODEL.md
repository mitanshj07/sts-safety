# 4. Database Schema & Smart Contract Specification

The executable artifacts live here:

| Artifact | File |
| --- | --- |
| Full PostGIS DDL, functions, triggers, cron, RLS | `supabase/migrations/20250101000000_init.sql` |
| Digital ID contract interface + rationale | `packages/contracts/src/interfaces/ITouristIdentityRegistry.sol` |
| Digital ID implementation | `packages/contracts/src/TouristIdentityRegistry.sol` |
| Incident/E-FIR anchoring contract | `packages/contracts/src/IncidentAnchor.sol` |

This document explains the model and specifies the parts that must match **exactly** across the database, the backend, and the chain — the hashing rules. Get those wrong and integrity verification silently fails.

---

## 4.1 Entity relationship overview

```
auth.users ──1:1── profiles ──1:1── tourists ──1:N── itineraries
                       │                │
                       │                ├──1:1(active)── digital_ids ──► on-chain TDID token
                       │                ├──1:N── location_pings  (raw, 24 h retention)
                       │                ├──1:N── location_tracks (hourly LineStrings, long term)
                       │                └──1:N── incidents
                       │                            ├──1:N── incident_events   (append-only)
                       │                            ├──1:N── dispatches ──N:1── responders
                       │                            ├──1:N── notifications
                       │                            ├──0:1── efir_drafts
                       │                            └──1:N── chain_anchors ──► on-chain IncidentAnchor
                       └──1:N── push_subscriptions

zones ──(spatial join, no FK)── location_pings / incidents
audit_log ── everything
```

There is deliberately **no foreign key from pings to zones**. Zone membership is a spatial predicate evaluated at insert time and cached in `tourists.current_zone_ids`. If an admin redraws a zone, history is not retroactively rewritten, which is the correct behaviour for an evidentiary system.

## 4.2 Table roles at a glance

| Table | Purpose | Volume profile |
| --- | --- | --- |
| `profiles` | Role assignment on top of Supabase Auth | tiny |
| `tourists` | All PII, cached hot state (`last_geog`, `safety_score`) | hundreds |
| `digital_ids` | Mirror of on-chain credential state | 1 active per tourist |
| `zones` | Geofence polygons + time-window rules | tens to hundreds |
| `itineraries` | Planned route `LineString` + allowed corridor | 1–3 per tourist |
| `location_pings` | Raw telemetry — the only high-write table | 10 writes/s at demo scale, purged at 24 h |
| `location_tracks` | Hourly downsampled `LineString` | 24 rows/tourist/day |
| `incidents` | The system's output | tens per demo |
| `incident_events` | Append-only timeline, never updated | ~5 per incident |
| `responders`, `dispatches` | Response side | tens |
| `notifications` | Per-channel delivery audit | ~4 per incident |
| `efir_drafts` | LLM-drafted E-FIR + PDF pointer | rare |
| `chain_anchors` | Outbox for on-chain writes, with retry | 1–3 per high-severity incident |
| `audit_log` | Who did what | everything privileged |

**Free-tier storage arithmetic.** A `location_pings` row is roughly 120 bytes. 50 tourists × 1 ping / 5 s × 24 h ≈ 864 k rows ≈ 104 MB — which is why the 24-hour retention job exists and why long-term history is stored as `LineString` geometries instead. Without downsampling you exhaust the 500 MB free tier in under a week of continuous simulation.

## 4.3 The three things that must be byte-identical everywhere

These are the specifications that couple the database, the Node backend, and Solidity. Implement them once in `packages/shared/src/utils/hash.ts` and import everywhere. Never re-implement them inline.

### (a) Canonical JSON

Before any `keccak256`, an object is serialised with: keys sorted lexicographically at every depth, no whitespace, UTF-8, `null` fields omitted entirely, numbers as shortest round-trip decimal, timestamps as unix **seconds** (not milliseconds, not ISO strings), and coordinates rounded to **7 decimal places** (~1 cm — beyond GPS precision, and it makes the hash stable across float representations).

### (b) KYC commitment

```
kycCommitment = keccak256(abi.encodePacked(uint8 kycType, string kycNumber, bytes32 salt))
```

- `kycType`: `1` passport, `2` aadhaar, `3` voter_id, `4` driving_licence — matching the `kyc_type` enum ordinal.
- Issuance policy (onboarding step 1, Zod, and `tourists_kyc_matches_nationality`): **Indian (`IN`) travellers must use Aadhaar**, with Voter ID or driving licence as equivalent Indian KYC. Indians start from **sign-up with DigiLocker** (landing or Tourist login tab): after they allow access the server fetches eAadhaar XML and issued documents, opens a tourist session if needed, and prefills the form. **International travellers must use a passport.** Aadhaar numbers are 12 digits (first digit 2–9) with a Verhoeff checksum; passport numbers follow ICAO 9303 shape.
- `kycNumber`: uppercased, all whitespace and hyphens stripped.
- `salt`: `tourists.kyc_salt`, 32 random bytes, generated once, never reused, never leaves the database unencrypted.

`abi.encodePacked` with a dynamic `string` in the middle is safe here only because `kycType` is fixed-width and `salt` is fixed-width — there is exactly one dynamic element, so no ambiguity is possible. Do not reorder these arguments.

TypeScript must produce the same bytes:

```ts
import { encodePacked, keccak256 } from 'viem';

export function kycCommitment(kycType: number, kycNumber: string, salt: `0x${string}`) {
  const normalised = kycNumber.toUpperCase().replace(/[\s-]/g, '');
  return keccak256(encodePacked(['uint8', 'string', 'bytes32'], [kycType, normalised, salt]));
}
```

Add a Foundry test that hardcodes a vector produced by the TypeScript implementation and asserts `verifyKyc` returns true. This cross-language test is the one that catches the bug at 3 a.m.

### (c) Incident record hash

```
recordHash = keccak256(utf8Bytes(canonicalJSON({
  id, tourist_token_id, type, severity, occurred_at,
  lat, lon, zone_id, detected_by, payload
})))
```

Note what is **excluded**: `status`, `ai_brief`, `acknowledged_at`, `resolved_at`, `updated_at`. Those legitimately change as the incident is worked. The hash covers only the immutable factual core — what happened, to whom, where, when. A resolution gets its **own** anchor of kind `Resolution` rather than mutating the original. This distinction is worth stating in the pitch: it is the difference between an audit trail and a hash that breaks every time someone clicks a button.

`incidents.id` is a UUID; on chain it is passed as `bytes16` (the raw 16 bytes, hyphens stripped, hex-decoded).

## 4.4 Contract summary

### `TouristIdentityRegistry` — ERC-721 + ERC-5192 soulbound

| Function | Access | Purpose |
| --- | --- | --- |
| `issue(...)` | `ISSUER_ROLE` | Mint a locked credential. Reverts if the holder already has an active one. |
| `issueBatch(...)` | `ISSUER_ROLE` | Tour-group issuance in one transaction. |
| `revoke(id, reason)` | `ISSUER_ROLE` | Permanent cancellation. |
| `suspend` / `reinstate` | `SUPERVISOR_ROLE` | Temporary freeze pending investigation. |
| `extendValidity(id, until)` | `ISSUER_ROLE` | Visa extension. Cannot shorten. |
| `updateItinerary(id, hash)` | `ISSUER_ROLE` | Emits old and new hash, so declared-plan history is reconstructable from events. |
| `verify(id)` | public view | The one-call integration point for hotels and checkpoints. |
| `verifyKyc(id, type, number, salt)` | public view | Selective disclosure — prove the document matches without publishing it. |
| `locked(id)` | public view | ERC-5192; always `true`. |

Enforcement of soulboundness happens in a single place, `_update()`, which is the only path through which OpenZeppelin v5 changes an ERC-721 balance. `approve` and `setApprovalForAll` also revert so that no integrator is misled.

**Required tests** (`test/TouristIdentityRegistry.t.sol`):
1. Issue then `transferFrom` reverts with `SoulboundTokenNonTransferable`.
2. Issue then `safeTransferFrom` (both overloads) reverts.
3. `approve` and `setApprovalForAll` revert.
4. Fuzz invariant: for any actor, any recipient, any token, balance of a non-zero holder never decreases except via burn.
5. `verify` returns `false` after `validUntil` (use `vm.warp`).
6. `verify` returns `false` after `revoke`.
7. Non-issuer calling `issue` reverts with the AccessControl error.
8. Second `issue` to a holder with an active token reverts; succeeds after `revoke`.
9. `extendValidity` beyond `MAX_VALIDITY` reverts.
10. Cross-language commitment vector matches the TypeScript output.

### `IncidentAnchor`

Append-only `mapping(bytes16 => Anchor[])`. Multiple anchors per incident by design: creation, resolution, each E-FIR revision. `verifyIntegrity(id, hash)` walks the array newest-first and returns `(matched, anchoredAt)`, which the dashboard renders as a green or red badge.

Only hashes and coarse metadata (`severity`, `occurredAt`, token id) go on chain. No coordinates, no names, no incident text.

## 4.5 Deployment record

`packages/contracts/deployments/amoy.json` is committed to the repo:

```json
{
  "chainId": 80002,
  "network": "polygon-amoy",
  "TouristIdentityRegistry": {
    "address": "0x…",
    "deployedAtBlock": 0,
    "explorer": "https://amoy.polygonscan.com/address/0x…"
  },
  "IncidentAnchor": {
    "address": "0x…",
    "deployedAtBlock": 0,
    "explorer": "https://amoy.polygonscan.com/address/0x…"
  },
  "issuerAddress": "0x…",
  "deployedAt": "2025-01-01T00:00:00Z"
}
```

Verify both contracts on Amoy Polygonscan. Opening the verified "Read Contract" tab and calling `verify(1)` live in front of the jury takes fifteen seconds and settles the "is the blockchain real?" question permanently.
