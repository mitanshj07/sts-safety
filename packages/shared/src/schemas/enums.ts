// packages/shared/src/schemas/enums.ts
import { z } from "zod"

export const userRoleSchema = z.enum(["tourist", "responder", "admin", "auditor"])
export type UserRole = z.infer<typeof userRoleSchema>

export const kycTypeSchema = z.enum([
  "passport",
  "aadhaar",
  "voter_id",
  "driving_licence",
])
export type KycType = z.infer<typeof kycTypeSchema>
/** Indian issuance uses aadhaar (voter_id / driving_licence equivalent). International uses passport. */

/** Postgres enum ordinals — must match `kyc_type` declaration order. */
export const KYC_TYPE_ORDINAL: Record<KycType, number> = {
  passport: 1,
  aadhaar: 2,
  voter_id: 3,
  driving_licence: 4,
}

export const idStatusSchema = z.enum([
  "pending",
  "active",
  "expired",
  "revoked",
  "suspended",
])
export type IdStatus = z.infer<typeof idStatusSchema>

export const zoneCategorySchema = z.enum([
  "safe",
  "caution",
  "restricted",
  "high_risk",
  "border",
  "forest_reserve",
  "accommodation",
  "checkpoint",
  "medical",
])
export type ZoneCategory = z.infer<typeof zoneCategorySchema>

export const riskLevelSchema = z.enum(["none", "low", "medium", "high", "critical"])
export type RiskLevel = z.infer<typeof riskLevelSchema>

export const pingSourceSchema = z.enum(["phone", "band", "simulator", "manual"])
export type PingSource = z.infer<typeof pingSourceSchema>

export const incidentTypeSchema = z.enum([
  "sos",
  "geofence_entry_restricted",
  "geofence_exit_safe",
  "zone_time_violation",
  "route_deviation",
  "signal_lost",
  "prolonged_inactivity",
  "implausible_speed",
  "anomaly_ml",
  "battery_critical",
  "missed_checkin",
  "manual_report",
])
export type IncidentType = z.infer<typeof incidentTypeSchema>

export const severityLevelSchema = z.enum([
  "info",
  "low",
  "medium",
  "high",
  "critical",
])
export type SeverityLevel = z.infer<typeof severityLevelSchema>

export const incidentStatusSchema = z.enum([
  "open",
  "acknowledged",
  "dispatched",
  "resolved",
  "false_positive",
  "expired",
])
export type IncidentStatus = z.infer<typeof incidentStatusSchema>

export const detectionSourceSchema = z.enum([
  "rules",
  "ml",
  "rules+ml",
  "manual",
  "device",
])
export type DetectionSource = z.infer<typeof detectionSourceSchema>

export const dispatchStatusSchema = z.enum([
  "sent",
  "acknowledged",
  "en_route",
  "on_scene",
  "completed",
  "declined",
  "timeout",
])
export type DispatchStatus = z.infer<typeof dispatchStatusSchema>

export const notifyChannelSchema = z.enum([
  "webpush",
  "telegram",
  "email",
  "realtime",
  "sms",
])
export type NotifyChannel = z.infer<typeof notifyChannelSchema>

export const notifyStatusSchema = z.enum(["queued", "sent", "delivered", "failed"])
export type NotifyStatus = z.infer<typeof notifyStatusSchema>

export const touristStatusSchema = z.enum(["active", "checked_out", "inactive"])
export type TouristStatus = z.infer<typeof touristStatusSchema>
