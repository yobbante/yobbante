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
      business_account_managers: {
        Row: {
          business_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          manager_user_id: string | null
          phone: string | null
          photo_url: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          manager_user_id?: string | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          manager_user_id?: string | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_account_managers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_accounts: {
        Row: {
          activated_at: string | null
          admin_email: string
          admin_full_name: string
          admin_phone: string
          admin_role: string
          created_at: string
          headquarters_address: string
          id: string
          legal_form: string
          legal_name: string
          ninea: string
          sector: string
          status: Database["public"]["Enums"]["business_account_status"]
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          activated_at?: string | null
          admin_email: string
          admin_full_name: string
          admin_phone: string
          admin_role: string
          created_at?: string
          headquarters_address: string
          id?: string
          legal_form: string
          legal_name: string
          ninea: string
          sector: string
          status?: Database["public"]["Enums"]["business_account_status"]
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          activated_at?: string | null
          admin_email?: string
          admin_full_name?: string
          admin_phone?: string
          admin_role?: string
          created_at?: string
          headquarters_address?: string
          id?: string
          legal_form?: string
          legal_name?: string
          ninea?: string
          sector?: string
          status?: Database["public"]["Enums"]["business_account_status"]
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      business_invitations: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["business_member_role"]
          status: Database["public"]["Enums"]["business_invitation_status"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["business_member_role"]
          status?: Database["public"]["Enums"]["business_invitation_status"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["business_member_role"]
          status?: Database["public"]["Enums"]["business_invitation_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_invoices: {
        Row: {
          amount_eur: number
          amount_xof: number | null
          business_id: string
          created_at: string
          description: string | null
          dossier_id: string | null
          due_at: string
          id: string
          issued_at: string
          last_reminder_at: string | null
          paid_at: string | null
          reference: string
          reminder_count: number
          shipment_id: string | null
          status: Database["public"]["Enums"]["business_invoice_status"]
          updated_at: string
        }
        Insert: {
          amount_eur?: number
          amount_xof?: number | null
          business_id: string
          created_at?: string
          description?: string | null
          dossier_id?: string | null
          due_at?: string
          id?: string
          issued_at?: string
          last_reminder_at?: string | null
          paid_at?: string | null
          reference?: string
          reminder_count?: number
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["business_invoice_status"]
          updated_at?: string
        }
        Update: {
          amount_eur?: number
          amount_xof?: number | null
          business_id?: string
          created_at?: string
          description?: string | null
          dossier_id?: string | null
          due_at?: string
          id?: string
          issued_at?: string
          last_reminder_at?: string | null
          paid_at?: string | null
          reference?: string
          reminder_count?: number
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["business_invoice_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string
          role: Database["public"]["Enums"]["business_member_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["business_member_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["business_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      coverage_zones: {
        Row: {
          active: boolean
          city: string
          country: string
          coverage_level: Database["public"]["Enums"]["coverage_level"]
          created_at: string
          currency_code: string
          id: string
          min_lead_hours: number
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          city: string
          country: string
          coverage_level?: Database["public"]["Enums"]["coverage_level"]
          created_at?: string
          currency_code?: string
          id?: string
          min_lead_hours?: number
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string
          country?: string
          coverage_level?: Database["public"]["Enums"]["coverage_level"]
          created_at?: string
          currency_code?: string
          id?: string
          min_lead_hours?: number
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_reviews: {
        Row: {
          comment: string | null
          created_at: string
          dossier_id: string
          id: string
          ip_address: string | null
          rating: number
          would_recommend: boolean | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          dossier_id: string
          id?: string
          ip_address?: string | null
          rating: number
          would_recommend?: boolean | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          dossier_id?: string
          id?: string
          ip_address?: string | null
          rating?: number
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_reviews_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      dekk_order_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dekk_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "dekk_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      dekk_orders: {
        Row: {
          address: string
          city: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          discount_eur: number
          id: string
          items: Json
          note: string | null
          payment_method: string
          promo_code: string | null
          promo_id: string | null
          reference: string
          status: string
          subtotal_eur: number
          total_eur: number
          total_fcfa: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          discount_eur?: number
          id?: string
          items?: Json
          note?: string | null
          payment_method: string
          promo_code?: string | null
          promo_id?: string | null
          reference: string
          status?: string
          subtotal_eur?: number
          total_eur?: number
          total_fcfa?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          discount_eur?: number
          id?: string
          items?: Json
          note?: string | null
          payment_method?: string
          promo_code?: string | null
          promo_id?: string | null
          reference?: string
          status?: string
          subtotal_eur?: number
          total_eur?: number
          total_fcfa?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dekk_orders_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "dekk_promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      dekk_promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number | null
          min_subtotal_eur: number
          updated_at: string
          used_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_subtotal_eur?: number
          updated_at?: string
          used_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_subtotal_eur?: number
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      dekk_promo_redemptions: {
        Row: {
          created_at: string
          discount_eur: number
          id: string
          order_id: string | null
          promo_id: string
        }
        Insert: {
          created_at?: string
          discount_eur: number
          id?: string
          order_id?: string | null
          promo_id: string
        }
        Update: {
          created_at?: string
          discount_eur?: number
          id?: string
          order_id?: string | null
          promo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dekk_promo_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "dekk_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dekk_promo_redemptions_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "dekk_promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      dossier_customs_documents: {
        Row: {
          created_at: string
          dossier_id: string
          file_name: string
          file_path: string
          generated_by: string
          id: string
          kind: Database["public"]["Enums"]["customs_document_kind"]
          metadata: Json
          reference: string
        }
        Insert: {
          created_at?: string
          dossier_id: string
          file_name: string
          file_path: string
          generated_by: string
          id?: string
          kind: Database["public"]["Enums"]["customs_document_kind"]
          metadata?: Json
          reference: string
        }
        Update: {
          created_at?: string
          dossier_id?: string
          file_name?: string
          file_path?: string
          generated_by?: string
          id?: string
          kind?: Database["public"]["Enums"]["customs_document_kind"]
          metadata?: Json
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossier_customs_documents_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
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
      dossier_events: {
        Row: {
          created_at: string
          created_by: string | null
          dossier_id: string
          event_data: Json | null
          event_type: string
          id: string
          visible_to_client: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dossier_id: string
          event_data?: Json | null
          event_type: string
          id?: string
          visible_to_client?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dossier_id?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          visible_to_client?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dossier_events_dossier_id_fkey"
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
          actual_weight_kg: number | null
          admin_notes: string | null
          app_source: string
          assigned_departure_id: string | null
          assigned_transporteur_ref: string | null
          budget_eur: number | null
          business_id: string | null
          buyer_contact: string | null
          buyer_country: string | null
          buyer_name: string | null
          cash_on_delivery: boolean
          collected_at: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          currency: string | null
          declared_value: number | null
          delivered_at: string | null
          destination_country: string
          dossier_type: Database["public"]["Enums"]["dossier_type"]
          estimated_cost: number | null
          estimated_delivery_date: string | null
          estimated_weight: number | null
          final_amount_xof: number | null
          gp_id: string | null
          hs_code: string | null
          id: string
          incoterm: string | null
          intake_by: string | null
          intake_method: string
          intake_notes: string | null
          konnekt_order_id: string | null
          konnekt_synced_at: string | null
          last_client_contact: string | null
          needs_sourcing: boolean
          notes: string | null
          origin_country: Database["public"]["Enums"]["warehouse_country"]
          payment_status: string
          product_description: string
          quantity: number | null
          reference: string
          reminder_count: number
          reminder_sent_at: string | null
          source: string
          source_reference: string | null
          status: Database["public"]["Enums"]["dossier_status"]
          supplier_contact: string | null
          supplier_country: string | null
          supplier_name: string | null
          tracking_id: string | null
          tracking_id_format: string
          unit: string | null
          updated_at: string
          user_id: string
          weighed_at: string | null
        }
        Insert: {
          actual_weight_kg?: number | null
          admin_notes?: string | null
          app_source?: string
          assigned_departure_id?: string | null
          assigned_transporteur_ref?: string | null
          budget_eur?: number | null
          business_id?: string | null
          buyer_contact?: string | null
          buyer_country?: string | null
          buyer_name?: string | null
          cash_on_delivery?: boolean
          collected_at?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string | null
          declared_value?: number | null
          delivered_at?: string | null
          destination_country?: string
          dossier_type?: Database["public"]["Enums"]["dossier_type"]
          estimated_cost?: number | null
          estimated_delivery_date?: string | null
          estimated_weight?: number | null
          final_amount_xof?: number | null
          gp_id?: string | null
          hs_code?: string | null
          id?: string
          incoterm?: string | null
          intake_by?: string | null
          intake_method?: string
          intake_notes?: string | null
          konnekt_order_id?: string | null
          konnekt_synced_at?: string | null
          last_client_contact?: string | null
          needs_sourcing?: boolean
          notes?: string | null
          origin_country: Database["public"]["Enums"]["warehouse_country"]
          payment_status?: string
          product_description: string
          quantity?: number | null
          reference?: string
          reminder_count?: number
          reminder_sent_at?: string | null
          source?: string
          source_reference?: string | null
          status?: Database["public"]["Enums"]["dossier_status"]
          supplier_contact?: string | null
          supplier_country?: string | null
          supplier_name?: string | null
          tracking_id?: string | null
          tracking_id_format?: string
          unit?: string | null
          updated_at?: string
          user_id: string
          weighed_at?: string | null
        }
        Update: {
          actual_weight_kg?: number | null
          admin_notes?: string | null
          app_source?: string
          assigned_departure_id?: string | null
          assigned_transporteur_ref?: string | null
          budget_eur?: number | null
          business_id?: string | null
          buyer_contact?: string | null
          buyer_country?: string | null
          buyer_name?: string | null
          cash_on_delivery?: boolean
          collected_at?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string | null
          declared_value?: number | null
          delivered_at?: string | null
          destination_country?: string
          dossier_type?: Database["public"]["Enums"]["dossier_type"]
          estimated_cost?: number | null
          estimated_delivery_date?: string | null
          estimated_weight?: number | null
          final_amount_xof?: number | null
          gp_id?: string | null
          hs_code?: string | null
          id?: string
          incoterm?: string | null
          intake_by?: string | null
          intake_method?: string
          intake_notes?: string | null
          konnekt_order_id?: string | null
          konnekt_synced_at?: string | null
          last_client_contact?: string | null
          needs_sourcing?: boolean
          notes?: string | null
          origin_country?: Database["public"]["Enums"]["warehouse_country"]
          payment_status?: string
          product_description?: string
          quantity?: number | null
          reference?: string
          reminder_count?: number
          reminder_sent_at?: string | null
          source?: string
          source_reference?: string | null
          status?: Database["public"]["Enums"]["dossier_status"]
          supplier_contact?: string | null
          supplier_country?: string | null
          supplier_name?: string | null
          tracking_id?: string | null
          tracking_id_format?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          weighed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_assigned_departure_id_fkey"
            columns: ["assigned_departure_id"]
            isOneToOne: false
            referencedRelation: "manual_departures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      gp_bot_sessions: {
        Row: {
          created_at: string
          from_phone: string
          id: string
          pending_data: Json
          pending_intent: string | null
          transporteur_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_phone: string
          id?: string
          pending_data?: Json
          pending_intent?: string | null
          transporteur_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_phone?: string
          id?: string
          pending_data?: Json
          pending_intent?: string | null
          transporteur_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gp_bot_sessions_transporteur_id_fkey"
            columns: ["transporteur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs"
            referencedColumns: ["id"]
          },
        ]
      }
      gp_import_logs: {
        Row: {
          created_at: string
          errors: number
          filename: string | null
          id: string
          imported: number
          imported_by: string | null
          total_rows: number
          updated: number
        }
        Insert: {
          created_at?: string
          errors?: number
          filename?: string | null
          id?: string
          imported?: number
          imported_by?: string | null
          total_rows?: number
          updated?: number
        }
        Update: {
          created_at?: string
          errors?: number
          filename?: string | null
          id?: string
          imported?: number
          imported_by?: string | null
          total_rows?: number
          updated?: number
        }
        Relationships: []
      }
      gp_unknown_contacts: {
        Row: {
          contacted_at: string
          followed_up: boolean
          followed_up_at: string | null
          followed_up_by: string | null
          from_name: string | null
          id: string
          message: string | null
          notes: string | null
          phone: string
        }
        Insert: {
          contacted_at?: string
          followed_up?: boolean
          followed_up_at?: string | null
          followed_up_by?: string | null
          from_name?: string | null
          id?: string
          message?: string | null
          notes?: string | null
          phone: string
        }
        Update: {
          contacted_at?: string
          followed_up?: boolean
          followed_up_at?: string | null
          followed_up_by?: string | null
          from_name?: string | null
          id?: string
          message?: string | null
          notes?: string | null
          phone?: string
        }
        Relationships: []
      }
      intake_drafts: {
        Row: {
          created_at: string
          draft_data: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draft_data?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          draft_data?: Json
          id?: string
          updated_at?: string
          user_id?: string
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
      legacy_dossiers: {
        Row: {
          amount: number | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          destination: string | null
          id: string
          imported_at: string
          legacy_id: string | null
          notes: string | null
          origin: string | null
          promoted_to_dossier_id: string | null
          source: string | null
          status_legacy: string | null
          type: string | null
          weight_kg: number | null
        }
        Insert: {
          amount?: number | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          destination?: string | null
          id?: string
          imported_at?: string
          legacy_id?: string | null
          notes?: string | null
          origin?: string | null
          promoted_to_dossier_id?: string | null
          source?: string | null
          status_legacy?: string | null
          type?: string | null
          weight_kg?: number | null
        }
        Update: {
          amount?: number | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          destination?: string | null
          id?: string
          imported_at?: string
          legacy_id?: string | null
          notes?: string | null
          origin?: string | null
          promoted_to_dossier_id?: string | null
          source?: string | null
          status_legacy?: string | null
          type?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "legacy_dossiers_promoted_to_dossier_id_fkey"
            columns: ["promoted_to_dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
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
          max_capacity_kg: number | null
          notes: string | null
          notes_admin: string | null
          origin_city: string
          origin_country: string | null
          price_override_xof: number | null
          publication_status: string
          published_at: string | null
          reserved_capacity_kg: number
          short_ref: string | null
          source: string
          status: string
          total_capacity_kg: number
          transport_mode: string
          transporteur_ref: string | null
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
          max_capacity_kg?: number | null
          notes?: string | null
          notes_admin?: string | null
          origin_city: string
          origin_country?: string | null
          price_override_xof?: number | null
          publication_status?: string
          published_at?: string | null
          reserved_capacity_kg?: number
          short_ref?: string | null
          source?: string
          status?: string
          total_capacity_kg: number
          transport_mode: string
          transporteur_ref?: string | null
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
          max_capacity_kg?: number | null
          notes?: string | null
          notes_admin?: string | null
          origin_city?: string
          origin_country?: string | null
          price_override_xof?: number | null
          publication_status?: string
          published_at?: string | null
          reserved_capacity_kg?: number
          short_ref?: string | null
          source?: string
          status?: string
          total_capacity_kg?: number
          transport_mode?: string
          transporteur_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_departures_transporteur_ref_fkey"
            columns: ["transporteur_ref"]
            isOneToOne: false
            referencedRelation: "transporteurs"
            referencedColumns: ["reference"]
          },
        ]
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
      products: {
        Row: {
          category: string
          created_at: string
          delivery_days: number | null
          description: string
          id: string
          image_url: string
          name: string
          origin_country: string
          price_eur: number
          price_fcfa: number
          source_type: string
          status: string
          stock_mode: string
          stock_qty: number | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          category: string
          created_at?: string
          delivery_days?: number | null
          description: string
          id?: string
          image_url: string
          name: string
          origin_country?: string
          price_eur?: number
          price_fcfa?: number
          source_type?: string
          status?: string
          stock_mode?: string
          stock_qty?: number | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          category?: string
          created_at?: string
          delivery_days?: number | null
          description?: string
          id?: string
          image_url?: string
          name?: string
          origin_country?: string
          price_eur?: number
          price_fcfa?: number
          source_type?: string
          status?: string
          stock_mode?: string
          stock_qty?: number | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_delivery_country: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          sourcing_profile:
            | Database["public"]["Enums"]["sourcing_profile"]
            | null
          user_id: string
        }
        Insert: {
          created_at?: string
          default_delivery_country?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          sourcing_profile?:
            | Database["public"]["Enums"]["sourcing_profile"]
            | null
          user_id: string
        }
        Update: {
          created_at?: string
          default_delivery_country?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          sourcing_profile?:
            | Database["public"]["Enums"]["sourcing_profile"]
            | null
          user_id?: string
        }
        Relationships: []
      }
      reception_orders: {
        Row: {
          actual_dimensions_cm: Json | null
          actual_weight_kg: number | null
          client_note: string | null
          created_at: string
          estimated_value_eur: number | null
          estimated_weight_kg: number | null
          expected_packages: number
          final_price_eur: number | null
          final_price_xof: number | null
          goods_type: string
          id: string
          internal_note: string | null
          merchant_name: string
          merchant_url: string | null
          order_description: string
          order_reference: string | null
          payment_status: string
          priority: string
          reference: string
          relay_address_id: string
          shipment_id: string | null
          status: string
          transport_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_dimensions_cm?: Json | null
          actual_weight_kg?: number | null
          client_note?: string | null
          created_at?: string
          estimated_value_eur?: number | null
          estimated_weight_kg?: number | null
          expected_packages?: number
          final_price_eur?: number | null
          final_price_xof?: number | null
          goods_type?: string
          id?: string
          internal_note?: string | null
          merchant_name: string
          merchant_url?: string | null
          order_description: string
          order_reference?: string | null
          payment_status?: string
          priority?: string
          reference?: string
          relay_address_id: string
          shipment_id?: string | null
          status?: string
          transport_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_dimensions_cm?: Json | null
          actual_weight_kg?: number | null
          client_note?: string | null
          created_at?: string
          estimated_value_eur?: number | null
          estimated_weight_kg?: number | null
          expected_packages?: number
          final_price_eur?: number | null
          final_price_xof?: number | null
          goods_type?: string
          id?: string
          internal_note?: string | null
          merchant_name?: string
          merchant_url?: string | null
          order_description?: string
          order_reference?: string | null
          payment_status?: string
          priority?: string
          reference?: string
          relay_address_id?: string
          shipment_id?: string | null
          status?: string
          transport_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reception_orders_relay_address_id_fkey"
            columns: ["relay_address_id"]
            isOneToOne: false
            referencedRelation: "relay_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      reception_packages: {
        Row: {
          created_at: string
          dimensions_cm: Json | null
          id: string
          notes: string | null
          order_id: string
          package_number: number
          photo_url: string | null
          received_at: string | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          dimensions_cm?: Json | null
          id?: string
          notes?: string | null
          order_id: string
          package_number?: number
          photo_url?: string | null
          received_at?: string | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          dimensions_cm?: Json | null
          id?: string
          notes?: string | null
          order_id?: string
          package_number?: number
          photo_url?: string | null
          received_at?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reception_packages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "reception_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_requests: {
        Row: {
          amount_eur: number | null
          attempts: number
          created_at: string
          error: string | null
          id: string
          processed_at: string | null
          provider_ref: string | null
          reason: string | null
          shipment_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          amount_eur?: number | null
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          processed_at?: string | null
          provider_ref?: string | null
          reason?: string | null
          shipment_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          amount_eur?: number | null
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          processed_at?: string | null
          provider_ref?: string | null
          reason?: string | null
          shipment_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      relay_addresses: {
        Row: {
          active: boolean
          address_line1: string
          address_line2: string | null
          city: string
          contact_name: string | null
          country: string
          country_code: string
          created_at: string
          id: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address_line1: string
          address_line2?: string | null
          city: string
          contact_name?: string | null
          country: string
          country_code: string
          created_at?: string
          id?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address_line1?: string
          address_line2?: string | null
          city?: string
          contact_name?: string | null
          country?: string
          country_code?: string
          created_at?: string
          id?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
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
      transporteur_inscriptions: {
        Row: {
          created_at: string
          id: string
          nom: string
          notes: string | null
          prenom: string
          source: string
          status: string
          telephone: string
          types_transport: string[]
          updated_at: string
          ville: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          notes?: string | null
          prenom: string
          source?: string
          status?: string
          telephone: string
          types_transport?: string[]
          updated_at?: string
          ville: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          notes?: string | null
          prenom?: string
          source?: string
          status?: string
          telephone?: string
          types_transport?: string[]
          updated_at?: string
          ville?: string
        }
        Relationships: []
      }
      transporteurs: {
        Row: {
          actif: boolean
          adresse_1: string
          adresse_2: string | null
          adresse_collecte_dakar: string | null
          adresses_remise: Json
          beta_invite_sent_at: string | null
          bot_paused_until: string | null
          created_at: string
          destinations: string[] | null
          id: string
          invitation_bot_sent_at: string | null
          konnekt_registered: boolean
          konnekt_registered_at: string | null
          modes_transport: string[] | null
          nom: string
          notes: string | null
          prenom: string | null
          reference: string
          telephone_1: string
          telephone_2: string | null
          updated_at: string
          ville: string
          whatsapp: string | null
          zone: string | null
        }
        Insert: {
          actif?: boolean
          adresse_1: string
          adresse_2?: string | null
          adresse_collecte_dakar?: string | null
          adresses_remise?: Json
          beta_invite_sent_at?: string | null
          bot_paused_until?: string | null
          created_at?: string
          destinations?: string[] | null
          id?: string
          invitation_bot_sent_at?: string | null
          konnekt_registered?: boolean
          konnekt_registered_at?: string | null
          modes_transport?: string[] | null
          nom: string
          notes?: string | null
          prenom?: string | null
          reference: string
          telephone_1: string
          telephone_2?: string | null
          updated_at?: string
          ville: string
          whatsapp?: string | null
          zone?: string | null
        }
        Update: {
          actif?: boolean
          adresse_1?: string
          adresse_2?: string | null
          adresse_collecte_dakar?: string | null
          adresses_remise?: Json
          beta_invite_sent_at?: string | null
          bot_paused_until?: string | null
          created_at?: string
          destinations?: string[] | null
          id?: string
          invitation_bot_sent_at?: string | null
          konnekt_registered?: boolean
          konnekt_registered_at?: string | null
          modes_transport?: string[] | null
          nom?: string
          notes?: string | null
          prenom?: string | null
          reference?: string
          telephone_1?: string
          telephone_2?: string | null
          updated_at?: string
          ville?: string
          whatsapp?: string | null
          zone?: string | null
        }
        Relationships: []
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
      whatsapp_inbound_messages: {
        Row: {
          bot_intent: string | null
          bot_response: string | null
          channel: string
          dossier_id: string | null
          from_name: string | null
          from_phone: string
          id: string
          is_read: boolean
          media_url: string | null
          message_body: string | null
          message_type: string
          received_at: string
          replied_at: string | null
          replied_by: string | null
          reply_template: string | null
          to_number: string | null
          transporteur_id: string | null
          wamid: string | null
        }
        Insert: {
          bot_intent?: string | null
          bot_response?: string | null
          channel?: string
          dossier_id?: string | null
          from_name?: string | null
          from_phone: string
          id?: string
          is_read?: boolean
          media_url?: string | null
          message_body?: string | null
          message_type?: string
          received_at?: string
          replied_at?: string | null
          replied_by?: string | null
          reply_template?: string | null
          to_number?: string | null
          transporteur_id?: string | null
          wamid?: string | null
        }
        Update: {
          bot_intent?: string | null
          bot_response?: string | null
          channel?: string
          dossier_id?: string | null
          from_name?: string | null
          from_phone?: string
          id?: string
          is_read?: boolean
          media_url?: string | null
          message_body?: string | null
          message_type?: string
          received_at?: string
          replied_at?: string | null
          replied_by?: string | null
          reply_template?: string | null
          to_number?: string | null
          transporteur_id?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbound_messages_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_messages_transporteur_id_fkey"
            columns: ["transporteur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_outbound_messages: {
        Row: {
          created_at: string
          created_by: string | null
          dossier_id: string | null
          error_message: string | null
          from_number: string | null
          id: string
          message_body: string | null
          recipient_type: string
          status: string
          template_name: string | null
          template_params: Json | null
          to_phone: string
          transporteur_id: string | null
          trigger_type: string | null
          wamid: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dossier_id?: string | null
          error_message?: string | null
          from_number?: string | null
          id?: string
          message_body?: string | null
          recipient_type?: string
          status?: string
          template_name?: string | null
          template_params?: Json | null
          to_phone: string
          transporteur_id?: string | null
          trigger_type?: string | null
          wamid?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dossier_id?: string | null
          error_message?: string | null
          from_number?: string | null
          id?: string
          message_body?: string | null
          recipient_type?: string
          status?: string
          template_name?: string | null
          template_params?: Json | null
          to_phone?: string
          transporteur_id?: string | null
          trigger_type?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_outbound_messages_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_outbound_messages_transporteur_id_fkey"
            columns: ["transporteur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs"
            referencedColumns: ["id"]
          },
        ]
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
      _wa_send_via_function: {
        Args: {
          p_dossier_id: string
          p_recipient_phone: string
          p_recipient_type: string
          p_template_name: string
          p_template_params: Json
          p_transporteur_id: string
          p_trigger_type: string
        }
        Returns: undefined
      }
      auto_match_shipment: { Args: { p_shipment_id: string }; Returns: string }
      auto_progress_departures: { Args: never; Returns: number }
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
      cancel_shipment: {
        Args: { p_reason?: string; p_shipment_id: string }
        Returns: Json
      }
      dekk_consume_promo: {
        Args: { p_code: string; p_order_id: string; p_subtotal_eur: number }
        Returns: {
          discount_eur: number
          promo_id: string
          total_eur: number
        }[]
      }
      expire_past_manual_departures: { Args: never; Returns: number }
      expire_unpaid_shipments: { Args: never; Returns: number }
      generate_business_invoice_reference: { Args: never; Returns: string }
      generate_dossier_reference: { Args: never; Returns: string }
      generate_identifier_code: {
        Args: { p_country: Database["public"]["Enums"]["warehouse_country"] }
        Returns: string
      }
      generate_reception_reference: { Args: never; Returns: string }
      generate_shipment_tracking_number: { Args: never; Returns: string }
      generate_tracking_id_v2: { Args: never; Returns: string }
      generate_unique_short_ref: { Args: never; Returns: string }
      get_user_contact: {
        Args: { _user_id: string }
        Returns: {
          email: string
          full_name: string
          phone: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_business_admin: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      is_business_member: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      lookup_dossier_public: {
        Args: { p_tracking: string }
        Returns: {
          created_at: string
          destination_country: string
          estimated_cost: number
          estimated_delivery_date: string
          estimated_weight: number
          origin_country: string
          payment_status: string
          reference: string
          status: Database["public"]["Enums"]["dossier_status"]
          tracking_id: string
        }[]
      }
      mark_overdue_invoices: { Args: never; Returns: number }
      monitor_shipment_etas: { Args: never; Returns: number }
      recompute_departure_reserved_capacity: {
        Args: { p_departure_id: string }
        Returns: undefined
      }
      rematch_waiting_shipments: { Args: never; Returns: number }
      resolve_zone_for_country: { Args: { p_country: string }; Returns: string }
      review_exists_for_tracking: {
        Args: { p_tracking: string }
        Returns: boolean
      }
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
      shipment_status_message: {
        Args: { _status: string; _tracking: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "user"
      business_account_status: "pending" | "active" | "suspended"
      business_invitation_status: "pending" | "accepted" | "expired" | "revoked"
      business_invoice_status:
        | "draft"
        | "unpaid"
        | "paid"
        | "overdue"
        | "cancelled"
      business_member_role: "admin" | "operator" | "viewer"
      coverage_level: "direct" | "partner" | "none"
      customs_document_kind:
        | "proforma_invoice"
        | "packing_list"
        | "bill_of_lading"
        | "customs_declaration"
        | "commercial_invoice"
        | "certificate_of_origin"
      dossier_status:
        | "SUBMITTED"
        | "IN_REVIEW"
        | "SOURCING"
        | "PROCURED"
        | "IN_TRANSIT"
        | "CUSTOMS"
        | "DELIVERED"
        | "CLOSED"
        | "AWAITING_CLIENT"
        | "CONFIRMED"
        | "STALE"
        | "EN_RECHERCHE_DEPART"
        | "ASSIGNED"
        | "COLLECTED"
        | "WEIGHED"
        | "ARRIVED_HUB"
        | "OUT_FOR_DELIVERY"
        | "CANCELLED"
        | "ARCHIVED"
      dossier_type:
        | "individual"
        | "business_import"
        | "business_export"
        | "business_sourcing"
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
      sourcing_profile: "individual" | "business"
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
      business_account_status: ["pending", "active", "suspended"],
      business_invitation_status: ["pending", "accepted", "expired", "revoked"],
      business_invoice_status: [
        "draft",
        "unpaid",
        "paid",
        "overdue",
        "cancelled",
      ],
      business_member_role: ["admin", "operator", "viewer"],
      coverage_level: ["direct", "partner", "none"],
      customs_document_kind: [
        "proforma_invoice",
        "packing_list",
        "bill_of_lading",
        "customs_declaration",
        "commercial_invoice",
        "certificate_of_origin",
      ],
      dossier_status: [
        "SUBMITTED",
        "IN_REVIEW",
        "SOURCING",
        "PROCURED",
        "IN_TRANSIT",
        "CUSTOMS",
        "DELIVERED",
        "CLOSED",
        "AWAITING_CLIENT",
        "CONFIRMED",
        "STALE",
        "EN_RECHERCHE_DEPART",
        "ASSIGNED",
        "COLLECTED",
        "WEIGHED",
        "ARRIVED_HUB",
        "OUT_FOR_DELIVERY",
        "CANCELLED",
        "ARCHIVED",
      ],
      dossier_type: [
        "individual",
        "business_import",
        "business_export",
        "business_sourcing",
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
      sourcing_profile: ["individual", "business"],
      warehouse_country: ["FR", "CN", "US", "CA", "AE", "DE", "SN"],
    },
  },
} as const
