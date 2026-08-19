// apps/web/src/lib/auth/demo.ts
// Seeded demo credentials (see supabase/seed/03_demo_tourists.sql + 04_demo_staff.sql).
// Not env vars — .env.example has none for this.

export const DEMO_PASSWORD = "DemoPass123!";

export const DEMO_OFFICER = {
  email: "admin@demo.sts",
  password: DEMO_PASSWORD,
  label: "Control Room Admin",
} as const;

export const DEMO_TOURISTS = [
  {
    slug: "priya-sharma",
    email: "priya.sharma@demo.sts",
    password: DEMO_PASSWORD,
    label: "Priya Sharma",
    nationality: "IN",
    kyc: "Aadhaar",
    route: "Guwahati → Shillong",
  },
  {
    slug: "ananya-baruah",
    email: "ananya.baruah@demo.sts",
    password: DEMO_PASSWORD,
    label: "Ananya Baruah",
    nationality: "IN",
    kyc: "Aadhaar",
    route: "Guwahati → Cherrapunji",
  },
  {
    slug: "emma-wilson",
    email: "emma.wilson@demo.sts",
    password: DEMO_PASSWORD,
    label: "Emma Wilson",
    nationality: "GB",
    kyc: "Passport",
    route: "Tezpur → Tawang",
  },
  {
    slug: "tenzin-dorje",
    email: "tenzin.dorje@demo.sts",
    password: DEMO_PASSWORD,
    label: "Tenzin Dorje",
    nationality: "IN",
    kyc: "Voter ID",
    route: "Tawang pilgrim",
  },
  {
    slug: "kenji-nakamura",
    email: "kenji.nakamura@demo.sts",
    password: DEMO_PASSWORD,
    label: "Kenji Nakamura",
    nationality: "JP",
    kyc: "Passport",
    route: "Guwahati → Kaziranga",
  },
] as const;

export type DemoTourist = (typeof DEMO_TOURISTS)[number];

/** Headline seeded traveller (SIH walkthrough). */
export const DEMO_TOURIST = DEMO_TOURISTS[0];

export const DEMO_TOURIST_DISPLAY_NAME = "Demo Tourist";

export function touristSubtitle(tourist: DemoTourist): string {
  return `${tourist.nationality} · ${tourist.kyc} · ${tourist.route}`;
}
