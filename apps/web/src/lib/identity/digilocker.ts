// apps/web/src/lib/identity/digilocker.ts
import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import {
  DEMO_DIGILOCKER_CODE,
  DEMO_DIGILOCKER_PROFILE,
  mapIssuedDocuments,
  parseDigilockerDob,
  parseEAadhaarXml,
  type DigilockerFetchedProfile,
  type DigilockerIssuedItem,
  type DigilockerSession,
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
  const explicit = trim(serverEnv.digilockerMode);
  if (explicit === "live" || explicit === "demo") return explicit;
  return trim(serverEnv.digilockerClientId) && trim(serverEnv.digilockerClientSecret)
    ? "live"
    : "demo";
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
  return url.toString();
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
  if (/eAadhaar|share|Link Aadhaar/i.test(msg)) return "missing_aadhaar";
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

export function loginReadyUrl(request: Request): URL {
  const url = new URL("/login", requestOrigin(request));
  url.searchParams.set("tab", "tourist");
  url.searchParams.set("digilocker", "ready");
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

async function exchangeCode(args: {
  request: Request;
  code: string;
  verifier: string;
}): Promise<string> {
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
  return token;
}

async function fetchUser(token: string): Promise<{
  name: string;
  dateOfBirth: string | null;
  eaadhaar: boolean;
  digilockerId: string;
}> {
  const res = await fetch(`${digilockerBaseUrl()}/oauth2/1/user`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const json = await readJson(res);
  if (!res.ok) {
    throw new Error(asString(json.error_description) || "user lookup failed");
  }
  return {
    name: asString(json.name),
    dateOfBirth: parseDigilockerDob(asString(json.dob)),
    eaadhaar: asString(json.eaadhaar).toUpperCase() === "Y",
    digilockerId: asString(json.digilockerid),
  };
}

function verifyFileHmac(body: string, header: string | null): boolean {
  if (!header) return true;
  const expected = createHmac("sha256", serverEnv.digilockerClientSecret)
    .update(body)
    .digest("base64");
  try {
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function fetchEAadhaar(token: string): Promise<ReturnType<typeof parseEAadhaarXml>> {
  const res = await fetch(`${digilockerBaseUrl()}/oauth2/3/xml/eaadhaar`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const xml = await res.text();
  if (!res.ok) {
    identityLog("digilocker_eaadhaar_unavailable", { status: res.status, ok: false });
    return null;
  }
  const hmac = res.headers.get("hmac") ?? res.headers.get("x-hmac");
  if (!verifyFileHmac(xml, hmac)) {
    throw new Error("eAadhaar HMAC mismatch");
  }
  return parseEAadhaarXml(xml);
}

async function fetchIssued(token: string): Promise<DigilockerIssuedItem[]> {
  const res = await fetch(`${digilockerBaseUrl()}/oauth2/2/files/issued`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const json = await readJson(res);
  if (!res.ok) {
    identityLog("digilocker_issued_unavailable", { status: res.status, ok: false });
    return [];
  }
  const items = json.items;
  if (!Array.isArray(items)) return [];
  return items.filter((row): row is DigilockerIssuedItem => Boolean(row && typeof row === "object"));
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
  const accessToken = await exchangeCode({
    request: args.request,
    code: args.code,
    verifier: args.oauth.verifier,
  });
  const user = await fetchUser(accessToken);
  const eaadhaar = await fetchEAadhaar(accessToken);
  const issued = mapIssuedDocuments(await fetchIssued(accessToken));
  const documents = eaadhaar
    ? [
        {
          kycType: "aadhaar" as const,
          label: "eAadhaar",
          issuer: "UIDAI",
          doctype: "ADHAR",
        },
        ...issued.filter((d) => d.kycType !== "aadhaar"),
      ]
    : issued;

  const kycType: KycType = eaadhaar ? "aadhaar" : (issued[0]?.kycType ?? "aadhaar");
  const kycNumber = eaadhaar?.uid ?? "";
  if (!kycNumber) {
    throw new Error("DigiLocker did not share eAadhaar. Link Aadhaar or enter the document manually.");
  }

  identityLog("digilocker_live_fetch", {
    ok: true,
    eaadhaar: Boolean(eaadhaar),
    flagged: user.eaadhaar,
    docs: documents.length,
  });

  return {
    name: eaadhaar?.name || user.name,
    dateOfBirth: eaadhaar?.dateOfBirth ?? user.dateOfBirth,
    kycType,
    kycNumber,
    documents,
    digilockerId: user.digilockerId,
    mode: "live",
  };
}
