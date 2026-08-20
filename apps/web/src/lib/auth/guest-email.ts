/** Fallback accounts when hosted Auth has anonymous sign-ins disabled. */
export const GUEST_EMAIL_DOMAIN = "guests.sts";

export function isGuestTouristEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}
