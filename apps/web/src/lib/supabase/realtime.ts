// apps/web/src/lib/supabase/realtime.ts
import "server-only";

export {
  broadcastIncident,
  realtimeChannel,
} from "@/lib/notify/channels/realtime";
export {
  DASHBOARD_BROADCAST_CHANNEL,
  DASHBOARD_BROADCAST_EVENT,
  touristBroadcastChannel,
} from "@/lib/notify/types";
