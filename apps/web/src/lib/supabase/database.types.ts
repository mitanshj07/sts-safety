// apps/web/src/lib/supabase/database.types.ts
// Minimal Database shape for the auth/data layer. Regenerated later via
// `pnpm db:types` (supabase gen types) — keep the generator's Row/Insert/Update form.

export type UserRole = "tourist" | "responder" | "admin" | "auditor";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfileRow = {
  id: string;
  role: UserRole;
  display_name: string;
  phone_e164: string | null;
  locale: string;
  created_at: string;
  updated_at: string;
};

export type ProfileInsert = {
  id: string;
  role?: UserRole;
  display_name: string;
  phone_e164?: string | null;
  locale?: string;
  created_at?: string;
  updated_at?: string;
};

export type ProfileUpdate = {
  id?: string;
  role?: UserRole;
  display_name?: string;
  phone_e164?: string | null;
  locale?: string;
  created_at?: string;
  updated_at?: string;
};

export type TouristRow = {
  id: string;
  profile_id: string | null;
  full_name: string;
  nationality: string;
  date_of_birth: string | null;
  kyc_type: "passport" | "aadhaar" | "voter_id" | "driving_licence";
  kyc_number_enc: string;
  kyc_last4: string | null;
  kyc_salt: string;
  photo_path: string | null;
  phone_e164: string | null;
  email: string | null;
  emergency_contacts: Json;
  trip_start: string;
  trip_end: string;
  entry_point: string | null;
  safety_score: number;
  last_geog: unknown;
  last_ping_at: string | null;
  current_zone_ids: string[];
  tracking_enabled: boolean;
  hd_index: number | null;
  wallet_address: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type TouristInsert = {
  id?: string;
  profile_id?: string | null;
  full_name: string;
  nationality?: string;
  date_of_birth?: string | null;
  kyc_type: TouristRow["kyc_type"];
  kyc_number_enc: string;
  kyc_last4?: string | null;
  kyc_salt?: string;
  photo_path?: string | null;
  phone_e164?: string | null;
  email?: string | null;
  emergency_contacts?: Json;
  trip_start: string;
  trip_end: string;
  entry_point?: string | null;
  safety_score?: number;
  last_geog?: unknown;
  last_ping_at?: string | null;
  current_zone_ids?: string[];
  tracking_enabled?: boolean;
  hd_index?: number | null;
  wallet_address?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

export type TouristUpdate = Partial<TouristInsert>;

export type LocationPingInsert = {
  tourist_id: string;
  geog: string;
  accuracy_m?: number | null;
  altitude_m?: number | null;
  speed_mps?: number | null;
  heading_deg?: number | null;
  battery_pct?: number | null;
  source?: "phone" | "band" | "simulator" | "manual";
  is_mock?: boolean;
  recorded_at: string;
};

export type LocationPingRow = LocationPingInsert & {
  id: number;
  created_at: string;
  is_mock: boolean;
  source: "phone" | "band" | "simulator" | "manual";
};

export type IncidentInsert = {
  id?: string;
  tourist_id: string;
  type: string;
  severity: string;
  status?: string;
  detected_by?: string;
  geog?: string | null;
  zone_id?: string | null;
  payload?: Json;
  occurred_at?: string;
};

export type IncidentRow = IncidentInsert & {
  id: string;
  status: string;
  created_at: string;
};

export type ItineraryUpdate = {
  waypoints?: Json;
  title?: string;
  corridor_m?: number;
  active?: boolean;
};

export type ItineraryRow = {
  id: string;
  tourist_id: string;
  title: string;
  corridor_m: number;
  waypoints: Json;
  starts_at: string;
  ends_at: string;
  active: boolean;
};

export type NotificationRow = {
  id: number;
  incident_id: string | null;
  recipient_kind: string;
  recipient_id: string | null;
  channel: string;
  status: string;
  title: string | null;
  body: string | null;
  locale: string | null;
  provider_ref: string | null;
  error: string | null;
  attempts: number;
  created_at: string;
  delivered_at: string | null;
};

export type DigitalIdRow = {
  id: string;
  tourist_id: string;
  chain_id: number;
  contract_address: string;
  token_id: string | number | null;
  vc_path: string | null;
  status: string;
  issue_tx_hash: string | null;
  valid_from: string;
  valid_until: string;
  created_at: string;
};

export type PushSubscriptionInsert = {
  profile_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
};

export type PushSubscriptionRow = PushSubscriptionInsert & {
  id: number;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      tourists: {
        Row: TouristRow;
        Insert: TouristInsert;
        Update: TouristUpdate;
        Relationships: [];
      };
      location_pings: {
        Row: LocationPingRow;
        Insert: LocationPingInsert;
        Update: Partial<LocationPingInsert>;
        Relationships: [];
      };
      incidents: {
        Row: IncidentRow;
        Insert: IncidentInsert;
        Update: Partial<IncidentInsert>;
        Relationships: [];
      };
      itineraries: {
        Row: ItineraryRow;
        Insert: Partial<ItineraryRow> & { tourist_id: string; path: string };
        Update: ItineraryUpdate;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Partial<NotificationRow>;
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
      digital_ids: {
        Row: DigitalIdRow;
        Insert: Partial<DigitalIdRow>;
        Update: Partial<DigitalIdRow>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: PushSubscriptionInsert;
        Update: Partial<PushSubscriptionInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      health_ping: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      ensure_demo_tourist: {
        Args: { p_profile_id: string };
        Returns: string;
      };
      zones_as_geojson: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      my_itinerary_geojson: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      nearest_responders: {
        Args: { p_lon: number; p_lat: number; p_limit?: number };
        Returns: Array<{
          responder_id: string;
          name: string;
          distance_m: number;
          telegram_chat_id: string | null;
        }>;
      };
    };
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
