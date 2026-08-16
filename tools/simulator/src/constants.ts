// tools/simulator/src/constants.ts
export const WALK_MPS = 1.2
export const TREK_MPS = 0.8
export const CAR_KMH = 40
export const CAR_MPS = CAR_KMH / 3.6
export const TRAFFIC_MIN = 0.72
export const TRAFFIC_MAX = 1.22
export const GPS_SIGMA_M = 8
export const STATIONARY_GPS_SIGMA_M = 3
export const DROPOUT_MS = 30_000
export const DROPOUT_MEAN_INTERVAL_MS = 8 * 60 * 1000
export const DWELL_RADIUS_M = 40
export const BATTERY_DRAIN_MOVING_PER_HOUR = 4
export const BATTERY_DRAIN_IDLE_PER_HOUR = 1.2
export const DEMO_PASSWORD = "DemoPass123!"

export const DEMO_TOURISTS = [
  {
    email: "priya.sharma@demo.sts",
    label: "Priya Sharma",
    touristId: "22222222-2222-4222-8222-222222222201",
    profileId: "33333333-3333-4333-8333-333333333301",
  },
  {
    email: "ananya.baruah@demo.sts",
    label: "Ananya Baruah",
    touristId: "22222222-2222-4222-8222-222222222202",
    profileId: "33333333-3333-4333-8333-333333333302",
  },
  {
    email: "emma.wilson@demo.sts",
    label: "Emma Wilson",
    touristId: "22222222-2222-4222-8222-222222222203",
    profileId: "33333333-3333-4333-8333-333333333303",
  },
  {
    email: "tenzin.dorje@demo.sts",
    label: "Tenzin Dorje",
    touristId: "22222222-2222-4222-8222-222222222204",
    profileId: "33333333-3333-4333-8333-333333333304",
  },
  {
    email: "kenji.nakamura@demo.sts",
    label: "Kenji Nakamura",
    touristId: "22222222-2222-4222-8222-222222222205",
    profileId: "33333333-3333-4333-8333-333333333305",
  },
] as const

export const FIXED_ORIGIN_ISO = "2025-12-01T06:30:00.000+05:30"
export const STATIONARY_ORIGIN_ISO = "2025-12-01T02:00:00.000+05:30"
export const SIGNAL_LOSS_MS = 25 * 60 * 1000
export const STATIONARY_MS = 50 * 60 * 1000
export const DEVIATION_OFFSET_M = 3000
