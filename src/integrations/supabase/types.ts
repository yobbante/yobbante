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
      shipments: {
        Row: {
          created_at: string
          destination_country: string
          eta: string | null
          id: string
          konnekt_id: string | null
          origin_country: Database["public"]["Enums"]["warehouse_country"]
          status: Database["public"]["Enums"]["shipment_status"]
          total_cost: number | null
          transport_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          destination_country?: string
          eta?: string | null
          id?: string
          konnekt_id?: string | null
          origin_country: Database["public"]["Enums"]["warehouse_country"]
          status?: Database["public"]["Enums"]["shipment_status"]
          total_cost?: number | null
          transport_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          destination_country?: string
          eta?: string | null
          id?: string
          konnekt_id?: string | null
          origin_country?: Database["public"]["Enums"]["warehouse_country"]
          status?: Database["public"]["Enums"]["shipment_status"]
          total_cost?: number | null
          transport_type?: string | null
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_dossier_reference: { Args: never; Returns: string }
      generate_identifier_code: {
        Args: { p_country: Database["public"]["Enums"]["warehouse_country"] }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
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
      package_status:
        | "CREATED"
        | "RECEIVED"
        | "IN_STORAGE"
        | "READY_TO_SHIP"
        | "SHIPPED"
        | "DELIVERED"
      shipment_status: "PENDING" | "IN_TRANSIT" | "CUSTOMS" | "DELIVERED"
      warehouse_country: "FR" | "CN" | "US" | "CA" | "AE" | "DE"
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
      package_status: [
        "CREATED",
        "RECEIVED",
        "IN_STORAGE",
        "READY_TO_SHIP",
        "SHIPPED",
        "DELIVERED",
      ],
      shipment_status: ["PENDING", "IN_TRANSIT", "CUSTOMS", "DELIVERED"],
      warehouse_country: ["FR", "CN", "US", "CA", "AE", "DE"],
    },
  },
} as const
