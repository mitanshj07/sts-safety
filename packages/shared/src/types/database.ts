// packages/shared/src/types/database.ts
// Hand-written to match `supabase gen types typescript`.
// Regenerate later with: pnpm db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          ip: unknown
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: number
          ip?: unknown
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: number
          ip?: unknown
        }
        Relationships: []
      }
      chain_anchors: {
        Row: {
          attempts: number
          block_number: number | null
          chain_id: number
          confirmed_at: string | null
          contract_address: string | null
          created_at: string
          error: string | null
          id: string
          kind: Database["public"]["Enums"]["anchor_kind"]
          record_hash: string
          status: Database["public"]["Enums"]["anchor_status"]
          subject_id: string
          tx_hash: string | null
        }
        Insert: {
          attempts?: number
          block_number?: number | null
          chain_id: number
          confirmed_at?: string | null
          contract_address?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind: Database["public"]["Enums"]["anchor_kind"]
          record_hash: string
          status?: Database["public"]["Enums"]["anchor_status"]
          subject_id: string
          tx_hash?: string | null
        }
        Update: {
          attempts?: number
          block_number?: number | null
          chain_id?: number
          confirmed_at?: string | null
          contract_address?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["anchor_kind"]
          record_hash?: string
          status?: Database["public"]["Enums"]["anchor_status"]
          subject_id?: string
          tx_hash?: string | null
        }
        Relationships: []
      }
      digital_ids: {
        Row: {
          chain_id: number
          contract_address: string
          created_at: string
          holder_address: string
          id: string
          issue_block: number | null
          issue_tx_hash: string | null
          itinerary_hash: string | null
          kyc_commitment: string
          metadata_uri: string | null
          revoke_tx_hash: string | null
          revocation_reason: string | null
          status: Database["public"]["Enums"]["id_status"]
          token_id: number | null
          tourist_id: string
          updated_at: string
          valid_from: string
          valid_until: string
          vc_path: string | null
          vc_sha256: string | null
        }
        Insert: {
          chain_id: number
          contract_address: string
          created_at?: string
          holder_address: string
          id?: string
          issue_block?: number | null
          issue_tx_hash?: string | null
          itinerary_hash?: string | null
          kyc_commitment: string
          metadata_uri?: string | null
          revoke_tx_hash?: string | null
          revocation_reason?: string | null
          status?: Database["public"]["Enums"]["id_status"]
          token_id?: number | null
          tourist_id: string
          updated_at?: string
          valid_from: string
          valid_until: string
          vc_path?: string | null
          vc_sha256?: string | null
        }
        Update: {
          chain_id?: number
          contract_address?: string
          created_at?: string
          holder_address?: string
          id?: string
          issue_block?: number | null
          issue_tx_hash?: string | null
          itinerary_hash?: string | null
          kyc_commitment?: string
          metadata_uri?: string | null
          revoke_tx_hash?: string | null
          revocation_reason?: string | null
          status?: Database["public"]["Enums"]["id_status"]
          token_id?: number | null
          tourist_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string
          vc_path?: string | null
          vc_sha256?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "digital_ids_tourist_id_fkey"
            columns: ["tourist_id"]
            isOneToOne: false
            referencedRelation: "tourists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_ids_tourist_id_fkey"
            columns: ["tourist_id"]
            isOneToOne: false
            referencedRelation: "v_live_tourists"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatches: {
        Row: {
          acknowledged_at: string | null
          arrived_at: string | null
          completed_at: string | null
          distance_m: number | null
          eta_seconds: number | null
          id: string
          incident_id: string
          notes: string | null
          responder_id: string
          sent_at: string
          status: Database["public"]["Enums"]["dispatch_status"]
        }
        Insert: {
          acknowledged_at?: string | null
          arrived_at?: string | null
          completed_at?: string | null
          distance_m?: number | null
          eta_seconds?: number | null
          id?: string
          incident_id: string
          notes?: string | null
          responder_id: string
          sent_at?: string
          status?: Database["public"]["Enums"]["dispatch_status"]
        }
        Update: {
          acknowledged_at?: string | null
          arrived_at?: string | null
          completed_at?: string | null
          distance_m?: number | null
          eta_seconds?: number | null
          id?: string
          incident_id?: string
          notes?: string | null
          responder_id?: string
          sent_at?: string
          status?: Database["public"]["Enums"]["dispatch_status"]
        }
        Relationships: [
          {
            foreignKeyName: "dispatches_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "v_open_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_responder_id_fkey"
            columns: ["responder_id"]
            isOneToOne: false
            referencedRelation: "responders"
            referencedColumns: ["id"]
          },
        ]
      }
      efir_drafts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          incident_id: string
          narrative: string
          pdf_path: string | null
          pdf_sha256: string | null
          station_name: string | null
          structured: Json
          tourist_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          incident_id: string
          narrative: string
          pdf_path?: string | null
          pdf_sha256?: string | null
          station_name?: string | null
          structured?: Json
          tourist_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          incident_id?: string
          narrative?: string
          pdf_path?: string | null
          pdf_sha256?: string | null
          station_name?: string | null
          structured?: Json
          tourist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "efir_drafts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "efir_drafts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "efir_drafts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "v_open_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "efir_drafts_tourist_id_fkey"
            columns: ["tourist_id"]
            isOneToOne: false
            referencedRelation: "tourists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "efir_drafts_tourist_id_fkey"
            columns: ["tourist_id"]
            isOneToOne: false
            referencedRelation: "v_live_tourists"
            referencedColumns: ["id"]
          },
        ]
      }
      geocode_cache: {
        Row: {
          address_text: string
          created_at: string
          geohash: string
          lat: number
          lon: number
          provider: string
        }
        Insert: {
          address_text: string
          created_at?: string
          geohash: string
          lat: number
          lon: number
          provider?: string
        }
        Update: {
          address_text?: string
          created_at?: string
          geohash?: string
          lat?: number
          lon?: number
          provider?: string
        }
        Relationships: []
      }
      incident_events: {
        Row: {
          actor_id: string | null
          actor_label: string | null
          created_at: string
          detail: Json
          event_type: string
          id: number
          incident_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          detail?: Json
          event_type: string
          id?: number
          incident_id: string
        }
        Update: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          detail?: Json
          event_type?: string
          id?: number
          incident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "v_open_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          acknowledged_at: string | null
          address_text: string | null
          ai_brief: string | null
          ai_brief_model: string | null
          anomaly_score: number | null
          created_at: string
          detected_by: Database["public"]["Enums"]["detection_source"]
          geog: unknown
          id: string
          occurred_at: string
          payload: Json
          record_hash: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          safety_score_at: number | null
          severity: Database["public"]["Enums"]["severity_level"]
          status: Database["public"]["Enums"]["incident_status"]
          tourist_id: string | null
          type: Database["public"]["Enums"]["incident_type"]
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          address_text?: string | null
          ai_brief?: string | null
          ai_brief_model?: string | null
          anomaly_score?: number | null
          created_at?: string
          detected_by?: Database["public"]["Enums"]["detection_source"]
          geog?: unknown
          id?: string
          occurred_at?: string
          payload?: Json
          record_hash?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          safety_score_at?: number | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["incident_status"]
          tourist_id?: string | null
          type: Database["public"]["Enums"]["incident_type"]
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          address_text?: string | null
          ai_brief?: string | null
          ai_brief_model?: string | null
          anomaly_score?: number | null
          created_at?: string
          detected_by?: Database["public"]["Enums"]["detection_source"]
          geog?: unknown
          id?: string
          occurred_at?: string
          payload?: Json
          record_hash?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          safety_score_at?: number | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["incident_status"]
          tourist_id?: string | null
          type?: Database["public"]["Enums"]["incident_type"]
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_tourist_id_fkey"
            columns: ["tourist_id"]
            isOneToOne: false
            referencedRelation: "tourists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_tourist_id_fkey"
            columns: ["tourist_id"]
            isOneToOne: false
            referencedRelation: "v_live_tourists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "v_zone_risk_ranking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      itineraries: {
        Row: {
          active: boolean
          corridor_m: number
          created_at: string
          ends_at: string
          id: string
          path: unknown
          starts_at: string
          title: string
          tourist_id: string
          waypoints: Json
        }
        Insert: {
          active?: boolean
          corridor_m?: number
          created_at?: string
          ends_at: string
          id?: string
          path: unknown
          starts_at: string
          title?: string
          tourist_id: string
          waypoints?: Json
        }
        Update: {
          active?: boolean
          corridor_m?: number
          created_at?: string
          ends_at?: string
          id?: string
          path?: unknown
          starts_at?: string
          title?: string
          tourist_id?: string
          waypoints?: Json
        }
        Relationships: [
          {
            foreignKeyName: "itineraries_tourist_id_fkey"
            columns: ["tourist_id"]
            isOneToOne: false
            referencedRelation: "tourists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itineraries_tourist_id_fkey"
            columns: ["tourist_id"]
            isOneToOne: false
            referencedRelation: "v_live_tourists"
            referencedColumns: ["id"]
          },
        ]
      }
      location_pings: {
        Row: {
          accuracy_m: number | null
          altitude_m: number | null
          battery_pct: number | null
          created_at: string
          geog: unknown
          heading_deg: number | null
          id: number
          is_mock: boolean
          recorded_at: string
          source: Database["public"]["Enums"]["ping_source"]
          speed_mps: number | null
          tourist_id: string
        }
        Insert: {
          accuracy_m?: number | null
          altitude_m?: number | null
          battery_pct?: number | null
          created_at?: string
          geog: unknown
          heading_deg?: number | null
          id?: number
          is_mock?: boolean
          recorded_at: string
          source?: Database["public"]["Enums"]["ping_source"]
          speed_mps?: number | null
          tourist_id: string
        }
        Update: {
          accuracy_m?: number | null
          altitude_m?: number | null
          battery_pct?: number | null
          created_at?: string
          geog?: unknown
          heading_deg?: number | null
          id?: number
          is_mock?: boolean
          recorded_at?: string
          source?: Database["public"]["Enums"]["ping_source"]
          speed_mps?: number | null
          tourist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_pings_tourist_id_fkey"
            columns: ["tourist_id"]
            isOneToOne: false
            referencedRelation: "tourists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_pings_tourist_id_fkey"
            columns: ["tourist_id"]
            isOneToOne: false
            referencedRelation: "v_live_tourists"
            referencedColumns: ["id"]
          },
        ]
      }
      location_tracks: {
        Row: {
          bucket_end: string
          bucket_start: string
          distance_m: number | null
          id: number
          path: unknown
          point_count: number
          tourist_id: string
        }
        Insert: {
          bucket_end: string
          bucket_start: string
          distance_m?: number | null
          id?: number
          path: unknown
          point_count: number
          tourist_id: string
        }
        Update: {
          bucket_end?: string
          bucket_start?: string
          distance_m?: number | null
          id?: number
          path?: unknown
          point_count?: number
          tourist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_tracks_tourist_id_fkey"
            columns: ["tourist_id"]
            isOneToOne: false
            referencedRelation: "tourists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_tracks_tourist_id_fkey"
            columns: ["tourist_id"]
            isOneToOne: false
            referencedRelation: "v_live_tourists"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          body: string | null
          channel: Database["public"]["Enums"]["notify_channel"]
          created_at: string
          delivered_at: string | null
          error: string | null
          id: number
          incident_id: string | null
          locale: string | null
          provider_ref: string | null
          recipient_id: string | null
          recipient_kind: string
          status: Database["public"]["Enums"]["notify_status"]
          title: string | null
        }
        Insert: {
          attempts?: number
          body?: string | null
          channel: Database["public"]["Enums"]["notify_channel"]
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          id?: number
          incident_id?: string | null
          locale?: string | null
          provider_ref?: string | null
          recipient_id?: string | null
          recipient_kind: string
          status?: Database["public"]["Enums"]["notify_status"]
          title?: string | null
        }
        Update: {
          attempts?: number
          body?: string | null
          channel?: Database["public"]["Enums"]["notify_channel"]
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          id?: number
          incident_id?: string | null
          locale?: string | null
          provider_ref?: string | null
          recipient_id?: string | null
          recipient_kind?: string
          status?: Database["public"]["Enums"]["notify_status"]
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "v_open_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          locale: string
          phone_e164: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          locale?: string
          phone_e164?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          locale?: string
          phone_e164?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: number
          p256dh: string
          profile_id: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: number
          p256dh: string
          profile_id: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: number
          p256dh?: string
          profile_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      responders: {
        Row: {
          base_geog: unknown
          coverage_m: number
          created_at: string
          district: string | null
          id: string
          last_geog: unknown
          last_seen_at: string | null
          name: string
          on_duty: boolean
          phone_e164: string | null
          profile_id: string | null
          state_code: string | null
          station_name: string | null
          telegram_chat_id: string | null
          unit_type: string
        }
        Insert: {
          base_geog: unknown
          coverage_m?: number
          created_at?: string
          district?: string | null
          id?: string
          last_geog?: unknown
          last_seen_at?: string | null
          name: string
          on_duty?: boolean
          phone_e164?: string | null
          profile_id?: string | null
          state_code?: string | null
          station_name?: string | null
          telegram_chat_id?: string | null
          unit_type: string
        }
        Update: {
          base_geog?: unknown
          coverage_m?: number
          created_at?: string
          district?: string | null
          id?: string
          last_geog?: unknown
          last_seen_at?: string | null
          name?: string
          on_duty?: boolean
          phone_e164?: string | null
          profile_id?: string | null
          state_code?: string | null
          station_name?: string | null
          telegram_chat_id?: string | null
          unit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "responders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tourists: {
        Row: {
          created_at: string
          current_zone_ids: string[]
          date_of_birth: string | null
          email: string | null
          emergency_contacts: Json
          entry_point: string | null
          full_name: string
          hd_index: number | null
          id: string
          kyc_last4: string | null
          kyc_number_enc: string
          kyc_salt: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          kyc_type: Database["public"]["Enums"]["kyc_type"]
          last_geog: unknown
          last_ping_at: string | null
          nationality: string
          phone_e164: string | null
          photo_path: string | null
          profile_id: string | null
          safety_score: number
          status: string
          tracking_enabled: boolean
          trip_end: string
          trip_start: string
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          current_zone_ids?: string[]
          date_of_birth?: string | null
          email?: string | null
          emergency_contacts?: Json
          entry_point?: string | null
          full_name: string
          hd_index?: number | null
          id?: string
          kyc_last4?: string | null
          kyc_number_enc: string
          kyc_salt?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_type: Database["public"]["Enums"]["kyc_type"]
          last_geog?: unknown
          last_ping_at?: string | null
          nationality?: string
          phone_e164?: string | null
          photo_path?: string | null
          profile_id?: string | null
          safety_score?: number
          status?: string
          tracking_enabled?: boolean
          trip_end: string
          trip_start: string
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          current_zone_ids?: string[]
          date_of_birth?: string | null
          email?: string | null
          emergency_contacts?: Json
          entry_point?: string | null
          full_name?: string
          hd_index?: number | null
          id?: string
          kyc_last4?: string | null
          kyc_number_enc?: string
          kyc_salt?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_type?: Database["public"]["Enums"]["kyc_type"]
          last_geog?: unknown
          last_ping_at?: string | null
          nationality?: string
          phone_e164?: string | null
          photo_path?: string | null
          profile_id?: string | null
          safety_score?: number
          status?: string
          tracking_enabled?: boolean
          trip_end?: string
          trip_start?: string
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tourists_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          active: boolean
          advisory_text: string | null
          area_sqm: number | null
          category: Database["public"]["Enums"]["zone_category"]
          centroid: unknown
          created_at: string
          created_by: string | null
          description: string | null
          district: string | null
          geom: unknown
          id: string
          name: string
          name_local: Json
          requires_permit: boolean
          risk_level: Database["public"]["Enums"]["risk_level"]
          state_code: string | null
          time_windows: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          advisory_text?: string | null
          area_sqm?: number | null
          category: Database["public"]["Enums"]["zone_category"]
          centroid?: unknown
          created_at?: string
          created_by?: string | null
          description?: string | null
          district?: string | null
          geom: unknown
          id?: string
          name: string
          name_local?: Json
          requires_permit?: boolean
          risk_level?: Database["public"]["Enums"]["risk_level"]
          state_code?: string | null
          time_windows?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          advisory_text?: string | null
          area_sqm?: number | null
          category?: Database["public"]["Enums"]["zone_category"]
          centroid?: unknown
          created_at?: string
          created_by?: string | null
          description?: string | null
          district?: string | null
          geom?: unknown
          id?: string
          name?: string
          name_local?: Json
          requires_permit?: boolean
          risk_level?: Database["public"]["Enums"]["risk_level"]
          state_code?: string | null
          time_windows?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_live_tourists: {
        Row: {
          current_zone_ids: string[] | null
          full_name: string | null
          id: string | null
          id_status: Database["public"]["Enums"]["id_status"] | null
          last_ping_at: string | null
          lat: number | null
          lon: number | null
          nationality: string | null
          open_incidents: number | null
          safety_score: number | null
          token_id: number | null
        }
        Relationships: []
      }
      v_open_incidents: {
        Row: {
          address_text: string | null
          ai_brief: string | null
          anchor_status: Database["public"]["Enums"]["anchor_status"] | null
          anchor_tx: string | null
          anomaly_score: number | null
          id: string | null
          lat: number | null
          lon: number | null
          nationality: string | null
          occurred_at: string | null
          phone_e164: string | null
          severity: Database["public"]["Enums"]["severity_level"] | null
          status: Database["public"]["Enums"]["incident_status"] | null
          tourist_name: string | null
          type: Database["public"]["Enums"]["incident_type"] | null
          zone_category: Database["public"]["Enums"]["zone_category"] | null
          zone_name: string | null
        }
        Relationships: []
      }
      v_zone_risk_ranking: {
        Row: {
          category: Database["public"]["Enums"]["zone_category"] | null
          district: string | null
          id: string | null
          incident_count_30d: number | null
          name: string | null
          risk_level: Database["public"]["Enums"]["risk_level"] | null
          severe_count_30d: number | null
          state_code: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      anchor_kind:
        | "id_issue"
        | "id_revoke"
        | "id_extend"
        | "incident"
        | "incident_resolution"
        | "efir"
        | "zone_definition"
      anchor_status: "pending" | "submitted" | "confirmed" | "failed"
      detection_source: "rules" | "ml" | "rules+ml" | "manual" | "device"
      dispatch_status:
        | "sent"
        | "acknowledged"
        | "en_route"
        | "on_scene"
        | "completed"
        | "declined"
        | "timeout"
      id_status: "pending" | "active" | "expired" | "revoked" | "suspended"
      incident_status:
        | "open"
        | "acknowledged"
        | "dispatched"
        | "resolved"
        | "false_positive"
        | "expired"
      incident_type:
        | "sos"
        | "geofence_entry_restricted"
        | "geofence_exit_safe"
        | "zone_time_violation"
        | "route_deviation"
        | "signal_lost"
        | "prolonged_inactivity"
        | "implausible_speed"
        | "anomaly_ml"
        | "battery_critical"
        | "missed_checkin"
        | "manual_report"
      kyc_status: "skipped" | "pending" | "verified"
      kyc_type: "passport" | "aadhaar" | "voter_id" | "driving_licence"
      notify_channel: "webpush" | "telegram" | "email" | "realtime" | "sms"
      notify_status: "queued" | "sent" | "delivered" | "failed"
      ping_source: "phone" | "band" | "simulator" | "manual"
      risk_level: "none" | "low" | "medium" | "high" | "critical"
      severity_level: "info" | "low" | "medium" | "high" | "critical"
      user_role: "tourist" | "responder" | "admin" | "auditor"
      zone_category:
        | "safe"
        | "caution"
        | "restricted"
        | "high_risk"
        | "border"
        | "forest_reserve"
        | "accommodation"
        | "checkpoint"
        | "medical"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      anchor_kind: [
        "id_issue",
        "id_revoke",
        "id_extend",
        "incident",
        "incident_resolution",
        "efir",
        "zone_definition",
      ],
      anchor_status: ["pending", "submitted", "confirmed", "failed"],
      detection_source: ["rules", "ml", "rules+ml", "manual", "device"],
      dispatch_status: [
        "sent",
        "acknowledged",
        "en_route",
        "on_scene",
        "completed",
        "declined",
        "timeout",
      ],
      id_status: ["pending", "active", "expired", "revoked", "suspended"],
      incident_status: [
        "open",
        "acknowledged",
        "dispatched",
        "resolved",
        "false_positive",
        "expired",
      ],
      incident_type: [
        "sos",
        "geofence_entry_restricted",
        "geofence_exit_safe",
        "zone_time_violation",
        "route_deviation",
        "signal_lost",
        "prolonged_inactivity",
        "implausible_speed",
        "anomaly_ml",
        "battery_critical",
        "missed_checkin",
        "manual_report",
      ],
      kyc_status: ["skipped", "pending", "verified"],
      kyc_type: ["passport", "aadhaar", "voter_id", "driving_licence"],
      notify_channel: ["webpush", "telegram", "email", "realtime", "sms"],
      notify_status: ["queued", "sent", "delivered", "failed"],
      ping_source: ["phone", "band", "simulator", "manual"],
      risk_level: ["none", "low", "medium", "high", "critical"],
      severity_level: ["info", "low", "medium", "high", "critical"],
      user_role: ["tourist", "responder", "admin", "auditor"],
      zone_category: [
        "safe",
        "caution",
        "restricted",
        "high_risk",
        "border",
        "forest_reserve",
        "accommodation",
        "checkpoint",
        "medical",
      ],
    },
  },
} as const
