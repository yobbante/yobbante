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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line: string
          country: Database["public"]["Enums"]["warehouse_country"]
          created_at: string
          id: string
          identifier_code: string
          user_id: string
        }
        Insert: {
          address_line: string
          country: Database["public"]["Enums"]["warehouse_country"]
          created_at?: string
          id?: string
          identifier_code: string
          user_id: string
        }
        Update: {
          address_line?: string
          country?: Database["public"]["Enums"]["warehouse_country"]
          created_at?: string
          id?: string
          identifier_code?: string
          user_id?: string
        }
        Relationships: []
      }
      dossier_documents: {
        Row: {
          created_at: string
          dossier_id: string
          file_name: string
          file_path: string
          id: string
          kind: string
          mime_type: string | null
          size_bytes: number | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          dossier_id: string
          file_name: string
          file_path: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          dossier_id?: string
          file_name?: string
          file_path?: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossier_documents_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      dossier_messages: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string
          dossier_id: string
          id: string
          internal_note: boolean
        }
        Insert: {
          author_id: string
          author_role: string
          body: string
          created_at?: string
          dossier_id: string
          id?: string
          internal_note?: boolean
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          dossier_id?: string
          id?: string
          internal_note?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dossier_messages_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      dossiers: {
        Row: {
          admin_notes: string | null
          app_source: string
          budget_eur: number | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          destination_country: string
          estimated_cost: number | null
          estimated_delivery_date: string | null
          estimated_weight: number | null
          gp_id: string | null
          id: string
          konnekt_order_id: string | null
          konnekt_synced_at: string | null
          needs_sourcing: boolean
          notes: string | null
          origin_country: Database["public"]["Enums"]["warehouse_country"]
          product_description: string
          reference: string
          status: Database["public"]["Enums"]["dossier_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          app_source?: string
          budget_eur?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          destination_country?: string
          estimated_cost?: number | null
          estimated_delivery_date?: string | null
          estimated_weight?: number | null
          gp_id?: string | null
          id?: string
          konnekt_order_id?: string | null
          konnekt_synced_at?: string | null
          needs_sourcing?: boolean
          notes?: string | null
          origin_country: Database["public"]["Enums"]["warehouse_country"]
          product_description: string
          reference?: string
          status?: Database["public"]["Enums"]["dossier_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          app_source?: string
          budget_eur?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          destination_country?: string
          estimated_cost?: number | null
          estimated_delivery_date?: string | null
          estimated_weight?: number | null
          gp_id?: string | null
          id?: string
          konnekt_order_id?: string | null
          konnekt_synced_at?: string | null
          needs_sourcing?: boolean
          notes?: string | null
          origin_country?: Database["public"]["Enums"]["warehouse_country"]
          product_description?: string
          reference?: string
          status?: Database["public"]["Enums"]["dossier_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      enterprise_quotes: {
        Row: {
          admin_notes: string | null
          company: string
          created_at: string
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string
          role: string | null
          sector: string
          source: string
          status: Database["public"]["Enums"]["enterprise_quote_status"]
          updated_at: string
          volume: string
        }
        Insert: {
          admin_notes?: string | null
          company: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone: string
          role?: string | null
          sector: string
          source?: string
          status?: Database["public"]["Enums"]["enterprise_quote_status"]
          updated_at?: string
          volume: string
        }
        Update: {
          admin_notes?: string | null
          company?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          role?: string | null
          sector?: string
          source?: string
          status?: Database["public"]["Enums"]["enterprise_quote_status"]
          updated_at?: string
          volume?: string
        }
        Relationships: []
      }
      konnekt_departures: {
        Row: {
          available_capacity_kg: number
          created_at: string
          departure_date: string
          destination_city: string
          destination_country: string
          id: string
          konnekt_departure_id: string
          origin_city: string
          origin_country: string
          price_per_kg_eur: number | null
          raw: Json | null
          status: string
          total_capacity_kg: number
          transport: string
          transporter_id: string | null
          updated_at: string
        }
        Insert: {
          available_capacity_kg?: number
          created_at?: string
          departure_date: string
          destination_city: string
          destination_country: string
          id?: string
          konnekt_departure_id: string
          origin_city: string
          origin_country: string
          price_per_kg_eur?: number | null
          raw?: Json | null
          status?: string
          total_capacity_kg?: number
          transport?: string
          transporter_id?: string | null
          updated_at?: string
        }
        Update: {
          available_capacity_kg?: number
          created_at?: string
          departure_date?: string
          destination_city?: string
          destination_country?: string
          id?: string
          konnekt_departure_id?: string
          origin_city?: string
          origin_country?: string
          price_per_kg_eur?: number | null
          raw?: Json | null
          status?: string
          total_capacity_kg?: number
          transport?: string
          transporter_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      konnekt_departures_cache: {
        Row: {
          count: number
          departures: Json
          id: string
          source: string
          updated_at: string
        }
        Insert: {
          count?: number
          departures?: Json
          id?: string
          source: string
          updated_at?: string
        }
        Update: {
          count?: number
          departures?: Json
          id?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      konnekt_sync_log: {
        Row: {
          count: number
          created_at: string
          error_message: string | null
          id: string
          partner_authenticated: boolean
          raw_payload: Json | null
          source: string
          status: string
        }
        Insert: {
          count?: number
          created_at?: string
          error_message?: string | null
          id?: string
          partner_authenticated?: boolean
          raw_payload?: Json | null
          source: string
          status: string
        }
        Update: {
          count?: number
          created_at?: string
          error_message?: string | null
          id?: string
          partner_authenticated?: boolean
          raw_payload?: Json | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      manual_departures: {
        Row: {
          arrival_estimate: string | null
          available_capacity_kg: number
          carrier_contact: string | null
          carrier_name: string | null
          created_at: string
          created_by: string | null
          departure_date: string
          destination_city: string
          destination_country: string | null
          id: string
          notes: string | null
          origin_city: string
          origin_country: string | null
          price_override_xof: number | null
          source: string
          status: string
          total_capacity_kg: number
          transport_mode: string
          updated_at: string
        }
        Insert: {
          arrival_estimate?: string | null
          available_capacity_kg: number
          carrier_contact?: string | null
          carrier_name?: string | null
          created_at?: string
          created_by?: string | null
          departure_date: string
          destination_city: string
          destination_country?: string | null
          id?: string
          notes?: string | null
          origin_city: string
          origin_country?: string | null
          price_override_xof?: number | null
          source?: string
          status?: string
          total_capacity_kg: number
          transport_mode: string
          updated_at?: string
        }
        Update: {
          arrival_estimate?: string | null
          available_capacity_kg?: number
          carrier_contact?: string | null
          carrier_name?: string | null
          created_at?: string
          created_by?: string | null
          departure_date?: string
          destination_city?: string
          destination_country?: string | null
          id?: string
          notes?: string | null
          origin_city?: string
          origin_country?: string | null
          price_override_xof?: number | null
          source?: string
          status?: string
          total_capacity_kg?: number
          transport_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      manual_quote_requests: {
        Row: {
          client_name: string
          client_phone: string
          created_at: string
          destination_city: string
          destination_country: string | null
          id: string
          note: string | null
          origin_city: string
          origin_country: string | null
          priority: string | null
          source: string
          status: Database["public"]["Enums"]["manual_quote_status"]
          transport_mode: string | null
          updated_at: string
          user_id: string | null
          weight_kg: number
        }
        Insert: {
          client_name: string
          client_phone: string
          created_at?: string
          destination_city: string
          destination_country?: string | null
          id?: string
          note?: string | null
          origin_city: string
          origin_country?: string | null
          priority?: string | null
          source?: string
          status?: Database["public"]["Enums"]["manual_quote_status"]
          transport_mode?: string | null
          updated_at?: string
          user_id?: string | null
          weight_kg: number
        }
        Update: {
          client_name?: string
          client_phone?: string
          created_at?: string
          destination_city?: string
          destination_country?: string | null
          id?: string
          note?: string | null
          origin_city?: string
          origin_country?: string | null
          priority?: string | null
          source?: string
          status?: Database["public"]["Enums"]["manual_quote_status"]
          transport_mode?: string | null
          updated_at?: string
          user_id?: string | null
          weight_kg?: number
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          date_score: number
          departure_id: string
          id: string
          route_score: number
          score: number
          shipment_id: string
          status: string
          transporter_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date_score: number
          departure_id: string
          id?: string
          route_score: number
          score: number
          shipment_id: string
          status?: string
          transporter_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date_score?: number
          departure_id?: string
          id?: string
          route_score?: number
          score?: number
          shipment_id?: string
          status?: string
          transporter_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_departure_id_fkey"
            columns: ["departure_id"]
            isOneToOne: false
            referencedRelation: "konnekt_departures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          error: string | null
          id: string
          message: string
          recipient: string
          sent_at: string | null
          shipment_id: string | null
          status: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          message: string
          recipient: string
          sent_at?: string | null
          shipment_id?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          message?: string
          recipient?: string
          sent_at?: string | null
          shipment_id?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          description: string | null
          dossier_id: string | null
          id: string
          shipment_id: string | null
          status: Database["public"]["Enums"]["package_status"]
          user_id: string
          warehouse_country: Database["public"]["Enums"]["warehouse_country"]
          weight: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          dossier_id?: string | null
          id?: string
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["package_status"]
          user_id: string
          warehouse_country: Database["public"]["Enums"]["warehouse_country"]
          weight?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          dossier_id?: string | null
          id?: string
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["package_status"]
          user_id?: string
          warehouse_country?: Database["public"]["Enums"]["warehouse_country"]
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "packages_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_adjustments: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          multiplier: number
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          multiplier?: number
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          multiplier?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_delivery_country: string | null
          full_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_delivery_country?: string | null
          full_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_delivery_country?: string | null
          full_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      shipment_events: {
        Row: {
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          metadata: Json
          note: string | null
          shipment_id: string
          to_status: string | null
          triggered_by: string
        }
        Insert: {
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          shipment_id: string
          to_status?: string | null
          triggered_by?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          shipment_id?: string
          to_status?: string | null
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          assigned_departure_source: string | null
          client_note: string | null
          created_at: string
          departure_date: string | null
          destination_city: string | null
          destination_country: string
          eta: string | null
          id: string
          konnekt_departure_id: string | null
          konnekt_id: string | null
          manual_departure_id: string | null
          manual_request: boolean
          origin_city: string | null
          origin_country: Database["public"]["Enums"]["warehouse_country"]
          payment_status: string
          pending_assignment: boolean
          priority: string
          quote_id: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          total_cost: number | null
          tracking_number: string | null
          transport_metadata: Json | null
          transport_type: string | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          assigned_departure_source?: string | null
          client_note?: string | null
          created_at?: string
          departure_date?: string | null
          destination_city?: string | null
          destination_country?: string
          eta?: string | null
          id?: string
          konnekt_departure_id?: string | null
          konnekt_id?: string | null
          manual_departure_id?: string | null
          manual_request?: boolean
          origin_city?: string | null
          origin_country: Database["public"]["Enums"]["warehouse_country"]
          payment_status?: string
          pending_assignment?: boolean
          priority?: string
          quote_id?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          total_cost?: number | null
          tracking_number?: string | null
          transport_metadata?: Json | null
          transport_type?: string | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          assigned_departure_source?: string | null
          client_note?: string | null
          created_at?: string
          departure_date?: string | null
          destination_city?: string | null
          destination_country?: string
          eta?: string | null
          id?: string
          konnekt_departure_id?: string | null
          konnekt_id?: string | null
          manual_departure_id?: string | null
          manual_request?: boolean
          origin_city?: string | null
          origin_country?: Database["public"]["Enums"]["warehouse_country"]
          payment_status?: string
          pending_assignment?: boolean
          priority?: string
          quote_id?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          total_cost?: number | null
          tracking_number?: string | null
          transport_metadata?: Json | null
          transport_type?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_manual_departure_id_fkey"
            columns: ["manual_departure_id"]
            isOneToOne: false
            referencedRelation: "manual_departures"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          related_package_id: string | null
          related_shipment_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          related_package_id?: string | null
          related_shipment_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          related_package_id?: string | null
          related_shipment_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_related_package_id_fkey"
            columns: ["related_package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_related_shipment_id_fkey"
            columns: ["related_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      zone_pricing: {
        Row: {
          active: boolean
          base_price_xof: number
          created_at: string
          currency: string
          delivery_days_max: number
          delivery_days_min: number
          id: string
          min_taxable: number
          mode: string
          price_per_unit: number
          updated_at: string
          zone_id: string
        }
        Insert: {
          active?: boolean
          base_price_xof: number
          created_at?: string
          currency?: string
          delivery_days_max?: number
          delivery_days_min?: number
          id?: string
          min_taxable?: number
          mode: string
          price_per_unit: number
          updated_at?: string
          zone_id: string
        }
        Update: {
          active?: boolean
          base_price_xof?: number
          created_at?: string
          currency?: string
          delivery_days_max?: number
          delivery_days_min?: number
          id?: string
          min_taxable?: number
          mode?: string
          price_per_unit?: number
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_pricing_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["zone_id"]
          },
        ]
      }
      zones: {
        Row: {
          countries: string[]
          created_at: string
          modes: string[]
          updated_at: string
          zone_id: string
          zone_name: string
        }
        Insert: {
          countries?: string[]
          created_at?: string
          modes?: string[]
          updated_at?: string
          zone_id: string
          zone_name: string
        }
        Update: {
          countries?: string[]
          created_at?: string
          modes?: string[]
          updated_at?: string
          zone_id?: string
          zone_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      all_active_departures: {
        Row: {
          available_capacity_kg: number | null
          carrier_name: string | null
          departure_date: string | null
          destination_city: string | null
          destination_country: string | null
          external_id: string | null
          id: string | null
          origin_city: string | null
          origin_country: string | null
          price_override_xof: number | null
          price_per_kg_eur: number | null
          source: string | null
          status: string | null
          total_capacity_kg: number | null
          transport_mode: string | null
          transporter_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_match_shipment: { Args: { p_shipment_id: string }; Returns: string }
      calculate_quote: {
        Args: {
          p_destination_city?: string
          p_destination_country: string
          p_origin_city?: string
          p_origin_country: string
          p_priority?: string
          p_transport_type?: string
          p_weight_kg: number
        }
        Returns: {
          base_price_eur: number
          confidence: string
          currency: string
          eta_max_days: number
          eta_min_days: number
          margin_multiplier: number
          price_eur: number
          supply_adjustment_eur: number
          transport_type: string
          urgency_multiplier: number
          weight_cost_eur: number
        }[]
      }
      calculate_quote_v2: {
        Args: {
          p_destination_country: string
          p_goods_type?: string
          p_height_cm?: number
          p_length_cm?: number
          p_priority?: string
          p_real_weight_kg: number
          p_transport_mode?: string
          p_width_cm?: number
        }
        Returns: {
          base_price_xof: number
          confidence: string
          delivery_days_max: number
          delivery_days_min: number
          fallback_mode: boolean
          goods_mult: number
          insurance_required: boolean
          margin_mult: number
          price_eur: number
          price_xof: number
          raw_price_xof: number
          requires_manual_quote: boolean
          supply_mult: number
          taxable_weight_kg: number
          transport_mode: string
          urgency_mult: number
          volumetric_weight_kg: number
          weight_bracket_mult: number
          weight_cost_xof: number
          zone_id: string
          zone_name: string
        }[]
      }
      generate_dossier_reference: { Args: never; Returns: string }
      generate_identifier_code: {
        Args: { p_country: Database["public"]["Enums"]["warehouse_country"] }
        Returns: string
      }
      generate_shipment_tracking_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      rematch_waiting_shipments: { Args: never; Returns: number }
      resolve_zone_for_country: { Args: { p_country: string }; Returns: string }
      score_departure: {
        Args: {
          d_departure_date: string
          d_dest_city: string
          d_dest_country: string
          d_origin_city: string
          d_origin_country: string
          s_dest_city: string
          s_dest_country: string
          s_origin_city: string
          s_origin_country: string
          s_ready_date: string
        }
        Returns: {
          date_score: number
          final_score: number
          route_score: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "user"
      dossier_status:
        | "SUBMITTED"
        | "IN_REVIEW"
        | "SOURCING"
        | "PROCURED"
        | "IN_TRANSIT"
        | "CUSTOMS"
        | "DELIVERED"
        | "CLOSED"
      enterprise_quote_status:
        | "NEW"
        | "CONTACTED"
        | "QUALIFIED"
        | "WON"
        | "LOST"
      manual_quote_status: "pending" | "quoted" | "confirmed" | "cancelled"
      package_status:
        | "CREATED"
        | "RECEIVED"
        | "IN_STORAGE"
        | "READY_TO_SHIP"
        | "SHIPPED"
        | "DELIVERED"
      shipment_status:
        | "PENDING"
        | "IN_TRANSIT"
        | "CUSTOMS"
        | "DELIVERED"
        | "WAITING_FOR_MATCH"
        | "CONFIRMED"
        | "MATCHED"
        | "IN_PREPARATION"
        | "ARRIVED"
        | "OUT_FOR_DELIVERY"
        | "CANCELLED"
        | "ON_HOLD"
      warehouse_country: "FR" | "CN" | "US" | "CA" | "AE" | "DE" | "SN"
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
  public: {
    Enums: {
      app_role: ["admin", "staff", "user"],
      dossier_status: [
        "SUBMITTED",
        "IN_REVIEW",
        "SOURCING",
        "PROCURED",
        "IN_TRANSIT",
        "CUSTOMS",
        "DELIVERED",
        "CLOSED",
      ],
      enterprise_quote_status: ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"],
      manual_quote_status: ["pending", "quoted", "confirmed", "cancelled"],
      package_status: [
        "CREATED",
        "RECEIVED",
        "IN_STORAGE",
        "READY_TO_SHIP",
        "SHIPPED",
        "DELIVERED",
      ],
      shipment_status: [
        "PENDING",
        "IN_TRANSIT",
        "CUSTOMS",
        "DELIVERED",
        "WAITING_FOR_MATCH",
        "CONFIRMED",
        "MATCHED",
        "IN_PREPARATION",
        "ARRIVED",
        "OUT_FOR_DELIVERY",
        "CANCELLED",
        "ON_HOLD",
      ],
      warehouse_country: ["FR", "CN", "US", "CA", "AE", "DE", "SN"],
    },
  },
} as const
