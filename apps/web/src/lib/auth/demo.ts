// apps/web/src/lib/auth/demo.ts
// Seeded demo-officer credentials (see supabase/seed/04_demo_staff.sql).
// Not env vars — .env.example has none for this. Password matches tourist seed.

export const DEMO_OFFICER = {
  email: "admin@demo.sts",
  password: "DemoPass123!",
  label: "Control Room Admin",
} as const;

export const DEMO_TOURIST = {
  email: "priya.sharma@demo.sts",
  password: "DemoPass123!",
  label: "Priya Sharma",
} as const;

export const DEMO_TOURIST_DISPLAY_NAME = "Demo Tourist";
