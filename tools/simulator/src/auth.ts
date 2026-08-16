// tools/simulator/src/auth.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { DEMO_PASSWORD } from "./constants.ts"
import { routeById } from "./routes/index.ts"
import type { BoundTourist, SimPlan, TouristPlan } from "./types.ts"

export function adminClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function anonClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

function lineWkt(coords: [number, number][]): string {
  const body = coords.map(([lon, lat]) => `${lon} ${lat}`).join(", ")
  return `SRID=4326;LINESTRING(${body})`
}

function kycBytea(slot: number): string {
  return `\\x${Buffer.from(`sim-kyc-${slot}`, "utf8").toString("hex")}`
}

async function signIn(
  url: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<{ token: string; userId: string } | null> {
  const client = anonClient(url, anonKey)
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session || !data.user) return null
  return { token: data.session.access_token, userId: data.user.id }
}

async function ensureAuthUser(
  admin: SupabaseClient,
  url: string,
  anonKey: string,
  plan: TouristPlan,
): Promise<{ token: string; userId: string }> {
  const existing = await signIn(url, anonKey, plan.email, plan.password)
  if (existing) return existing

  const created = await admin.auth.admin.createUser({
    email: plan.email,
    password: plan.password,
    email_confirm: true,
    user_metadata: { display_name: plan.label, role: "tourist" },
  })
  if (created.error && !/already/i.test(created.error.message)) {
    throw new Error(`createUser ${plan.email}: ${created.error.message}`)
  }
  if (created.data.user) {
    await admin.from("profiles").upsert({
      id: created.data.user.id,
      role: "tourist",
      display_name: plan.label,
      locale: "en",
    })
  }

  const signed = await signIn(url, anonKey, plan.email, plan.password)
  if (signed) return signed

  await admin.auth.admin.updateUserById(created.data.user?.id ?? "", { password: DEMO_PASSWORD })
  const retry = await signIn(url, anonKey, plan.email, DEMO_PASSWORD)
  if (!retry) throw new Error(`sign-in failed for ${plan.email}`)
  return retry
}

async function lookupTouristId(
  admin: SupabaseClient,
  plan: TouristPlan,
  profileId: string,
): Promise<string | null> {
  if (plan.demoTouristId) {
    const { data } = await admin.from("tourists").select("id").eq("id", plan.demoTouristId).maybeSingle()
    if (data && typeof data === "object" && "id" in data && typeof data.id === "string") return data.id
  }
  const { data } = await admin.from("tourists").select("id").eq("profile_id", profileId).maybeSingle()
  if (data && typeof data === "object" && "id" in data && typeof data.id === "string") return data.id
  return null
}

async function ensureTouristRow(
  admin: SupabaseClient,
  plan: TouristPlan,
  profileId: string,
  corridorM: number,
): Promise<string> {
  const existing = await lookupTouristId(admin, plan, profileId)
  if (existing) return existing

  const { data, error } = await admin
    .from("tourists")
    .insert({
      profile_id: profileId,
      full_name: plan.label,
      nationality: "IN",
      kyc_type: "passport",
      kyc_number_enc: kycBytea(plan.slot),
      kyc_last4: "SIM0",
      email: plan.email,
      trip_start: new Date(Date.now() - 86400000).toISOString(),
      trip_end: new Date(Date.now() + 14 * 86400000).toISOString(),
      entry_point: "Simulator",
      tracking_enabled: true,
      hd_index: 1000 + plan.slot,
      status: "active",
    })
    .select("id")
    .single()
  if (error || !data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string") {
    throw new Error(`failed to insert tourist ${plan.email}: ${error?.message ?? "unknown"}`)
  }
  const touristId = data.id
  const route = routeById(plan.routeId)
  await admin.from("itineraries").insert({
    tourist_id: touristId,
    title: route.name,
    path: lineWkt(route.profile.coords),
    corridor_m: corridorM,
    waypoints: plan.waypoints,
    starts_at: new Date(Date.now() - 3600000).toISOString(),
    ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    active: true,
  })
  return touristId
}

export async function resetSimState(admin: SupabaseClient, touristIds: string[]): Promise<void> {
  if (touristIds.length === 0) return
  await admin.from("location_pings").delete().in("tourist_id", touristIds)
  await admin
    .from("incidents")
    .update({ status: "expired", resolved_at: new Date().toISOString() })
    .in("tourist_id", touristIds)
    .in("status", ["open", "acknowledged", "dispatched"])
  await admin
    .from("tourists")
    .update({
      last_geog: null,
      last_ping_at: null,
      current_zone_ids: [],
      safety_score: 100,
    })
    .in("id", touristIds)
}

export async function alignItinerary(
  admin: SupabaseClient,
  touristId: string,
  plan: TouristPlan,
  corridorM: number,
): Promise<void> {
  const route = routeById(plan.routeId)
  await admin.from("itineraries").update({ active: false }).eq("tourist_id", touristId)
  await admin.from("itineraries").insert({
    tourist_id: touristId,
    title: `sim:${route.name}`,
    path: lineWkt(route.profile.coords),
    corridor_m: corridorM,
    waypoints: plan.waypoints,
    starts_at: new Date(Date.now() - 3600000).toISOString(),
    ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    active: true,
  })
}

export async function bindTourists(
  url: string,
  anonKey: string,
  serviceKey: string,
  plan: SimPlan,
  corridorM: number,
): Promise<BoundTourist[]> {
  const admin = adminClient(url, serviceKey)
  const bound: BoundTourist[] = []

  for (const tourist of plan.tourists) {
    const auth = await ensureAuthUser(admin, url, anonKey, tourist)
    const touristId = await ensureTouristRow(admin, tourist, auth.userId, corridorM)
    await alignItinerary(admin, touristId, tourist, corridorM)
    bound.push({
      slot: tourist.slot,
      label: tourist.label,
      email: tourist.email,
      touristId,
      accessToken: auth.token,
      featured: tourist.featured,
    })
  }

  await resetSimState(
    admin,
    bound.map((b) => b.touristId),
  )
  return bound
}
