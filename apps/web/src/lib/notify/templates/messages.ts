// apps/web/src/lib/notify/templates/messages.ts
import type { IncidentType, SeverityLevel } from "@sts/shared";

import type { NotifyIncident, NotifyLocale } from "@/lib/notify/types";
import { NOTIFY_LOCALES } from "@/lib/notify/types";

export function parseLocale(value: string | null | undefined): NotifyLocale {
  const raw = (value ?? "en").slice(0, 2).toLowerCase();
  return (NOTIFY_LOCALES as readonly string[]).includes(raw)
    ? (raw as NotifyLocale)
    : "en";
}

function typeLabel(type: IncidentType, locale: NotifyLocale): string {
  const table: Record<NotifyLocale, Partial<Record<IncidentType, string>>> = {
    en: {
      sos: "SOS panic",
      geofence_entry_restricted: "Restricted-zone entry",
      signal_lost: "Signal lost",
      route_deviation: "Route deviation",
    },
    hi: {
      sos: "एसओएस पैनिक",
      geofence_entry_restricted: "निषिद्ध क्षेत्र प्रवेश",
      signal_lost: "सिग्नल खो गया",
      route_deviation: "मार्ग विचलन",
    },
    as: {
      sos: "SOS পেনিক",
      geofence_entry_restricted: "নিষিদ্ধ অঞ্চল প্ৰৱেশ",
      signal_lost: "সংকেত হেৰুৱা",
      route_deviation: "পথ বিচ্যুতি",
    },
    bn: {
      sos: "SOS প্যানিক",
      geofence_entry_restricted: "নিষিদ্ধ এলাকায় প্রবেশ",
      signal_lost: "সিগন্যাল হারিয়েছে",
      route_deviation: "পথচ্যুতি",
    },
    ne: {
      sos: "SOS प्यानिक",
      geofence_entry_restricted: "निषेधित क्षेत्र प्रवेश",
      signal_lost: "सङ्केत हरायो",
      route_deviation: "मार्ग विचलन",
    },
  };
  return table[locale][type] ?? type.replaceAll("_", " ");
}

export function incidentTitle(
  locale: NotifyLocale,
  type: IncidentType,
  severity: SeverityLevel,
): string {
  const label = typeLabel(type, locale);
  const sev = severity.toUpperCase();
  switch (locale) {
    case "hi":
      return `${sev} · ${label}`;
    case "as":
      return `${sev} · ${label}`;
    case "bn":
      return `${sev} · ${label}`;
    case "ne":
      return `${sev} · ${label}`;
    default:
      return `${sev} · ${label}`;
  }
}

export function incidentBody(
  locale: NotifyLocale,
  incident: NotifyIncident,
): string {
  const who = incident.touristName ?? "Unknown tourist";
  const where =
    incident.zoneName ?? incident.addressText ?? "unlocated";
  const coords =
    incident.lat !== null && incident.lon !== null
      ? `${incident.lat.toFixed(5)}, ${incident.lon.toFixed(5)}`
      : "n/a";
  switch (locale) {
    case "hi":
      return `${who} — ${typeLabel(incident.type, locale)} · ${where} (${coords}). तत्काल प्रतिक्रिया आवश्यक।`;
    case "as":
      return `${who} — ${typeLabel(incident.type, locale)} · ${where} (${coords})। তৎক্ষণাৎ সঁহাৰিৰ প্ৰয়োজন।`;
    case "bn":
      return `${who} — ${typeLabel(incident.type, locale)} · ${where} (${coords})। তাৎক্ষণিক সাড়া প্রয়োজন।`;
    case "ne":
      return `${who} — ${typeLabel(incident.type, locale)} · ${where} (${coords})। तत्काल प्रतिक्रिया आवश्यक।`;
    default:
      return `${who} — ${typeLabel(incident.type, "en")} at ${where} (${coords}). Immediate response required.`;
  }
}

export function helpOnTheWay(locale: NotifyLocale, etaMinutes: number | null): string {
  const eta = etaMinutes !== null ? `${etaMinutes} min` : "soon";
  switch (locale) {
    case "hi":
      return `सहायता भेज दी गई है। अनुमानित समय ${eta}।`;
    case "as":
      return `সহায় পঠোৱা হৈছে। আনুমানিক সময় ${eta}।`;
    case "bn":
      return `সাহায্য পাঠানো হয়েছে। আনুমানিক সময় ${eta}।`;
    case "ne":
      return `मद्दत पठाइएको छ। अनुमानित समय ${eta}।`;
    default:
      return `Help is on the way. ETA ${eta}.`;
  }
}

export function ackCopy(locale: NotifyLocale, actor: string, when: string): string {
  switch (locale) {
    case "hi":
      return `स्वीकृत: ${actor} · ${when}`;
    case "as":
      return `স্বীকাৰ: ${actor} · ${when}`;
    case "bn":
      return `স্বীকৃত: ${actor} · ${when}`;
    case "ne":
      return `स्वीकृत: ${actor} · ${when}`;
    default:
      return `Acknowledged by ${actor} at ${when}`;
  }
}

export function dashboardUrl(appUrl: string, incidentId: string): string {
  return `${appUrl.replace(/\/$/, "")}/incidents/${incidentId}`;
}

export function touristAlertUrl(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/alerts`;
}
