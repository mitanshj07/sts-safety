// apps/web/src/lib/identity/digilocker.ts
import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import {
  DEMO_DIGILOCKER_CODE,
  DEMO_DIGILOCKER_PROFILE,
  extractIssuedItems,
  issuedItemHasXml,
  issuedItemToKyc,
  mapIssuedDocuments,
  mergeDigilockerUserFields,
  parseDigilockerUserFields,
  parseEAadhaarXml,
  parseIssuedCertificateXml,
  resolveDigilockerKyc,
  type DigilockerFetchedProfile,
  type DigilockerIssuedItem,
  type DigilockerParsedCertificate,
  type DigilockerSession,
  type DigilockerUserFields,
  type KycType,
} from "@sts/shared";

import { serverEnv } from "@/lib/env/server";
import { identityLog } from "@/lib/identity/log";

export const DIGILOCKER_OAUTH_COOKIE = "sts_dl_oauth";
export const DIGILOCKER_SESSION_COOKIE = "sts_dl_kyc";
const COOKIE_MAX_AGE_S = 10 * 60;

export type DigilockerMode = "demo" | "live";

export type DigilockerIntent = "signup" | "onboard";

type OAuthCookie = {
  state: string;
  verifier: string;
  intent?: DigilockerIntent;
};

type SessionCookie = {
  name: string;
  dateOfBirth: string | null;
  kycType: KycType;
  kycNumber: string;
  documents: DigilockerFetchedProfile["documents"];
  digilockerId: string;
  mode: DigilockerMode;
};

function trim(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function digilockerMode(): DigilockerMode {
  const explicit = trim(serverEnv.digilockerMode).toLowerCase();
  if (explicit === "demo") return "demo";
  return "live";
}

function signingSecret(): string {
  const dedicated = trim(serverEnv.digilockerStateSecret);
  if (dedicated) return dedicated;
  const pipeline = trim(serverEnv.pipelineSecret);
  if (pipeline) return pipeline;
  if (digilockerMode() === "demo") return "sts-demo-digilocker-state";
  throw new Error("DIGILOCKER_STATE_SECRET (or PIPELINE_SECRET) is required in live mode");
}

export function digilockerBaseUrl(): string {
  const fromEnv = trim(serverEnv.digilockerBaseUrl);
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "https://digilocker.meripehchaan.gov.in/public";
}

export function requestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const proto =
      forwardedProto ||
      (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

export function digilockerRedirectUri(request: Request): string {
  const fromEnv = trim(serverEnv.digilockerRedirectUri);
  if (fromEnv) return fromEnv;
  return new URL("/api/identity/digilocker/callback", requestOrigin(request)).toString();
}

export function digilockerLiveConfigured(): boolean {
  return Boolean(trim(serverEnv.digilockerClientId) && trim(serverEnv.digilockerClientSecret));
}

export function cookieOptions(maxAge = COOKIE_MAX_AGE_S) {
  const https =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: https,
    path: "/",
    maxAge,
  };
}

function sign(payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function unsign<T>(token: string | undefined): T | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function encodeOAuthCookie(value: OAuthCookie): string {
  return sign(value);
}

export function decodeOAuthCookie(token: string | undefined): OAuthCookie | null {
  const parsed = unsign<OAuthCookie>(token);
  if (!parsed?.state || !parsed.verifier) return null;
  const intent =
    parsed.intent === "signup" || parsed.intent === "onboard"
      ? parsed.intent
      : undefined;
  return { state: parsed.state, verifier: parsed.verifier, intent };
}

export function encodeSessionCookie(value: SessionCookie): string {
  return sign(value);
}

export function decodeSessionCookie(token: string | undefined): SessionCookie | null {
  const parsed = unsign<SessionCookie>(token);
  if (!parsed?.kycNumber || !parsed.kycType || !parsed.name) return null;
  return parsed;
}

export function sessionToClient(session: SessionCookie): DigilockerSession {
  return {
    ok: true,
    source: "digilocker",
    mode: session.mode,
    name: session.name,
    dateOfBirth: session.dateOfBirth,
    kycType: session.kycType,
    kycNumber: session.kycNumber,
    kycLast4: session.kycNumber.replace(/[\s-]/g, "").slice(-4),
    documents: session.documents,
    digilockerId: session.digilockerId,
  };
}

function pkceVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function newOAuthState(intent: DigilockerIntent = "onboard"): OAuthCookie {
  return {
    state: randomBytes(16).toString("hex"),
    verifier: pkceVerifier(),
    intent,
  };
}

export function oauthIntentFromRequest(
  request: Request,
  hasTourist: boolean,
): DigilockerIntent {
  const url = new URL(request.url);
  const raw = url.searchParams.get("intent");
  if (raw === "signup" || raw === "onboard") return raw;
  return hasTourist ? "onboard" : "signup";
}

export function buildAuthorizeUrl(args: {
  request: Request;
  oauth: OAuthCookie;
}): string {
  const url = new URL(`${digilockerBaseUrl()}/oauth2/1/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", serverEnv.digilockerClientId);
  url.searchParams.set("redirect_uri", digilockerRedirectUri(args.request));
  url.searchParams.set("state", args.oauth.state);
  url.searchParams.set("code_challenge", pkceChallenge(args.oauth.verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", "openid");
  url.searchParams.set("acr", "aadhaar");
  url.searchParams.set("purpose", "kyc");
  return url.toString();
}

export type DigilockerPublicStatus = {
  mode: DigilockerMode;
  configured: boolean;
  host: string;
};

export function digilockerPublicStatus(): DigilockerPublicStatus {
  const mode = digilockerMode();
  let host = "digilocker.meripehchaan.gov.in";
  try {
    host = new URL(digilockerBaseUrl()).host;
  } catch {
    // keep the documented MeitY host
  }
  return {
    mode,
    configured: mode === "demo" || digilockerLiveConfigured(),
    host,
  };
}

export function demoConsentUrl(origin: string, state: string): string {
  const url = new URL("/login/digilocker", origin);
  url.searchParams.set("state", state);
  return url.toString();
}

export function startRedirectUrl(request: Request, oauth: OAuthCookie): {
  url: string | null;
  reason?: string;
} {
  if (digilockerMode() === "live") {
    if (!digilockerLiveConfigured()) return { url: null, reason: "config" };
    return { url: buildAuthorizeUrl({ request, oauth }) };
  }
  return { url: demoConsentUrl(requestOrigin(request), oauth.state) };
}

export function digilockerErrorReason(error: unknown): string {
  const msg = error instanceof Error ? error.message : "";
  if (/hmac/i.test(msg)) return "hmac";
  if (/eAadhaar|share|Link Aadhaar|did not share/i.test(msg)) return "missing_aadhaar";
  if (/not configured|credentials/i.test(msg)) return "config";
  return "fetch";
}

export function onboardStatusUrl(
  request: Request,
  status: "ok" | "error" | "denied",
  reason?: string,
): URL {
  const url = new URL("/onboard", requestOrigin(request));
  url.searchParams.set("digilocker", status);
  if (reason) url.searchParams.set("reason", reason);
  return url;
}

export function loginStatusUrl(
  request: Request,
  status: "error" | "denied",
  reason?: string,
): URL {
  const url = new URL("/login", requestOrigin(request));
  url.searchParams.set("tab", "tourist");
  url.searchParams.set("digilocker", status);
  if (reason) url.searchParams.set("reason", reason);
  return url;
}

export function flowStatusUrl(
  request: Request,
  intent: DigilockerIntent | undefined,
  status: "ok" | "error" | "denied",
  reason?: string,
): URL {
  if (status === "ok") return onboardStatusUrl(request, status, reason);
  if (intent === "signup") return loginStatusUrl(request, status, reason);
  return onboardStatusUrl(request, status, reason);
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    identityLog("digilocker_non_json", { status: res.status, ok: false });
  }
  return { error: "unexpected_error", raw: text.slice(0, 80) };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function bearer(token: string): HeadersInit {
  return { authorization: `Bearer ${token}` };
}

type TokenBundle = {
  accessToken: string;
  fields: DigilockerUserFields;
};

async function exchangeCode(args: {
  request: Request;
  code: string;
  verifier: string;
}): Promise<TokenBundle> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    client_id: serverEnv.digilockerClientId,
    client_secret: serverEnv.digilockerClientSecret,
    redirect_uri: digilockerRedirectUri(args.request),
    code_verifier: args.verifier,
  });
  const res = await fetch(`${digilockerBaseUrl()}/oauth2/2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await readJson(res);
  const token = asString(json.access_token);
  if (!res.ok || !token) {
    throw new Error(asString(json.error_description) || asString(json.error) || "token exchange failed");
  }
  return { accessToken: token, fields: parseDigilockerUserFields(json) };
}

async function fetchUser(token: string): Promise<DigilockerUserFields | null> {
  const res = await fetch(`${digilockerBaseUrl()}/oauth2/1/user`, {
    headers: bearer(token),
  });
  const json = await readJson(res);
  if (!res.ok) {
    identityLog("digilocker_user_unavailable", { status: res.status, ok: false });
    return null;
  }
  return parseDigilockerUserFields(json);
}

function verifyFileHmac(body: Buffer, header: string | null): "ok" | "missing" | "mismatch" {
  const provided = header?.trim() ?? "";
  if (!provided) return "missing";
  const secret = serverEnv.digilockerClientSecret;
  const expectedB64 = createHmac("sha256", secret).update(body).digest("base64");
  const expectedHex = createHmac("sha256", secret).update(body).digest("hex");
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expectedB64);
    if (a.length === b.length && timingSafeEqual(a, b)) return "ok";
  } catch {
    // fall through to hex compare
  }
  if (provided.toLowerCase() === expectedHex) return "ok";
  return "mismatch";
}

async function fetchXmlBody(
  path: string,
  token: string,
): Promise<{ body: Buffer; hmac: "ok" | "missing" | "mismatch" } | null> {
  const res = await fetch(`${digilockerBaseUrl()}${path}`, {
    headers: {
      ...bearer(token),
      accept: "application/xml, text/xml, */*",
    },
  });
  const body = Buffer.from(await res.arrayBuffer());
  if (!res.ok) return null;
  const hmacHeader = res.headers.get("hmac") ?? res.headers.get("x-hmac");
  return { body, hmac: verifyFileHmac(body, hmacHeader) };
}

function xmlFromFetched(
  fetched: { body: Buffer; hmac: "ok" | "missing" | "mismatch" } | null,
  event: string,
): string | null {
  if (!fetched) {
    identityLog(event, { ok: false, reason: "unavailable" });
    return null;
  }
  if (fetched.hmac === "mismatch") {
    identityLog(event, { ok: false, reason: "hmac" });
    return null;
  }
  if (fetched.hmac === "missing") {
    identityLog(event, { ok: true, hmac: "missing" });
  }
  return fetched.body.toString("utf8");
}

async function fetchEAadhaar(token: string): Promise<ReturnType<typeof parseEAadhaarXml>> {
  const xml = xmlFromFetched(
    await fetchXmlBody("/oauth2/3/xml/eaadhaar", token),
    "digilocker_eaadhaar",
  );
  return xml ? parseEAadhaarXml(xml) : null;
}

async function fetchIssued(token: string): Promise<DigilockerIssuedItem[]> {
  const res = await fetch(`${digilockerBaseUrl()}/oauth2/2/files/issued`, {
    headers: { ...bearer(token), accept: "application/json" },
  });
  const json = await readJson(res);
  if (!res.ok) {
    identityLog("digilocker_issued_unavailable", { status: res.status, ok: false });
    return [];
  }
  return extractIssuedItems(json);
}

async function fetchIssuedXml(token: string, uri: string): Promise<string | null> {
  const trimmed = uri.trim().replace(/^\/+/, "");
  if (!trimmed) return null;
  const path = `/oauth2/1/xml/${encodeURIComponent(trimmed)}`;
  return xmlFromFetched(await fetchXmlBody(path, token), "digilocker_issued_xml");
}

async function fetchIssuedCertificates(
  token: string,
  items: DigilockerIssuedItem[],
): Promise<DigilockerParsedCertificate[]> {
  const out: DigilockerParsedCertificate[] = [];
  const seen = new Set<KycType>();
  for (const item of items) {
    const kycType = issuedItemToKyc(item);
    if (!kycType || seen.has(kycType) || !item.uri) continue;
    if (!issuedItemHasXml(item) && kycType !== "aadhaar") continue;
    const xml = await fetchIssuedXml(token, item.uri);
    if (!xml) continue;
    const parsed = parseIssuedCertificateXml(xml, kycType);
    if (!parsed) continue;
    seen.add(kycType);
    out.push(parsed);
  }
  return out;
}

function withEAadhaarDocument(
  documents: DigilockerFetchedProfile["documents"],
  eaadhaar: boolean,
): DigilockerFetchedProfile["documents"] {
  if (!eaadhaar || documents.some((doc) => doc.kycType === "aadhaar")) return documents;
  return [
    {
      kycType: "aadhaar",
      label: "eAadhaar",
      issuer: "UIDAI",
      doctype: "ADHAR",
    },
    ...documents,
  ];
}

export async function completeDigilocker(args: {
  request: Request;
  code: string;
  oauth: OAuthCookie;
}): Promise<SessionCookie> {
  const mode = digilockerMode();
  if (mode === "demo") {
    if (args.code !== DEMO_DIGILOCKER_CODE) {
      throw new Error("invalid demo code");
    }
    identityLog("digilocker_demo_fetch", {
      ok: true,
      docs: DEMO_DIGILOCKER_PROFILE.documents.length,
    });
    return {
      ...DEMO_DIGILOCKER_PROFILE,
      mode: "demo",
    };
  }
  if (!digilockerLiveConfigured()) {
    throw new Error("DigiLocker live credentials are not configured");
  }

  const token = await exchangeCode({
    request: args.request,
    code: args.code,
    verifier: args.oauth.verifier,
  });
  const userFromEndpoint = await fetchUser(token.accessToken);
  const user = mergeDigilockerUserFields(
    userFromEndpoint ?? parseDigilockerUserFields(null),
    token.fields,
  );
  const eaadhaar = await fetchEAadhaar(token.accessToken);
  const issuedItems = await fetchIssued(token.accessToken);
  const certificates = await fetchIssuedCertificates(token.accessToken, issuedItems);
  const resolved = resolveDigilockerKyc({
    name: user.name,
    dateOfBirth: user.dateOfBirth,
    eaadhaar,
    certificates,
  });
  if (!resolved?.kycNumber || !resolved.name) {
    throw new Error(
      "DigiLocker did not share eAadhaar. Link Aadhaar or enter the document manually.",
    );
  }

  const documents = withEAadhaarDocument(mapIssuedDocuments(issuedItems), Boolean(eaadhaar));

  identityLog("digilocker_live_fetch", {
    ok: true,
    eaadhaar: Boolean(eaadhaar),
    flagged: user.eaadhaarLinked,
    docs: documents.length,
    kyc: resolved.kycType,
  });

  return {
    name: resolved.name,
    dateOfBirth: resolved.dateOfBirth,
    kycType: resolved.kycType,
    kycNumber: resolved.kycNumber,
    documents,
    digilockerId: user.digilockerId,
    mode: "live",
  };
}
