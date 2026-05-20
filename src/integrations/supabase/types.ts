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
      agreement_acknowledgements: {
        Row: {
          acknowledged_at: string
          agreement_version: string
          created_at: string
          customer_id: string | null
          id: string
          ip_address: string | null
          renter_data: Json
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          agreement_version?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: string | null
          renter_data?: Json
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          agreement_version?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: string | null
          renter_data?: Json
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          emergency_email: string | null
          emergency_name: string | null
          emergency_phone: string | null
          emergency_relationship: string | null
          full_name: string
          id: string
          id_number: string | null
          id_type: string | null
          link_code: string | null
          notes: string | null
          occupation: string | null
          phone: string
          photo_url: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          emergency_email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relationship?: string | null
          full_name: string
          id?: string
          id_number?: string | null
          id_type?: string | null
          link_code?: string | null
          notes?: string | null
          occupation?: string | null
          phone: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          emergency_email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relationship?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          id_type?: string | null
          link_code?: string | null
          notes?: string | null
          occupation?: string | null
          phone?: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      document_audit: {
        Row: {
          action: string
          actor: string | null
          actor_role: string | null
          created_at: string
          document_id: string
          id: string
          meta: Json | null
        }
        Insert: {
          action: string
          actor?: string | null
          actor_role?: string | null
          created_at?: string
          document_id: string
          id?: string
          meta?: Json | null
        }
        Update: {
          action?: string
          actor?: string | null
          actor_role?: string | null
          created_at?: string
          document_id?: string
          id?: string
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_audit_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          customer_id: string | null
          doc_number: string | null
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          mime_type: string | null
          payment_id: string | null
          rental_id: string | null
          size_bytes: number | null
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          doc_number?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime_type?: string | null
          payment_id?: string | null
          rental_id?: string | null
          size_bytes?: number | null
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          doc_number?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime_type?: string | null
          payment_id?: string | null
          rental_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      item_movements: {
        Row: {
          actor: string | null
          created_at: string
          customer_id: string
          id: string
          movement_type: string
          notes: string | null
          qty_after: number
          qty_change: number
          release_id: string | null
          rental_id: string
          stored_item_id: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          customer_id: string
          id?: string
          movement_type: string
          notes?: string | null
          qty_after: number
          qty_change: number
          release_id?: string | null
          rental_id: string
          stored_item_id: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          movement_type?: string
          notes?: string | null
          qty_after?: number
          qty_change?: number
          release_id?: string | null
          rental_id?: string
          stored_item_id?: string
        }
        Relationships: []
      }
      item_releases: {
        Row: {
          condition_on_release: string | null
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          recipient_id_number: string | null
          recipient_id_type: string | null
          recipient_name: string
          recipient_phone: string | null
          released_at: string
          released_by: string
          rental_id: string
          waybill_number: string
          waybill_url: string | null
        }
        Insert: {
          condition_on_release?: string | null
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          recipient_id_number?: string | null
          recipient_id_type?: string | null
          recipient_name: string
          recipient_phone?: string | null
          released_at?: string
          released_by: string
          rental_id: string
          waybill_number: string
          waybill_url?: string | null
        }
        Update: {
          condition_on_release?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          recipient_id_number?: string | null
          recipient_id_type?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          released_at?: string
          released_by?: string
          rental_id?: string
          waybill_number?: string
          waybill_url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          balance: number | null
          created_at: string
          currency: string
          customer_id: string
          discount: number | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string
          receipt_url: string | null
          recorded_by: string | null
          reference: string | null
          rental_id: string
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          balance?: number | null
          created_at?: string
          currency?: string
          customer_id: string
          discount?: number | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          receipt_url?: string | null
          recorded_by?: string | null
          reference?: string | null
          rental_id: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          balance?: number | null
          created_at?: string
          currency?: string
          customer_id?: string
          discount?: number | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          receipt_url?: string | null
          recorded_by?: string | null
          reference?: string | null
          rental_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          channel: Database["public"]["Enums"]["reminder_channel"]
          created_at: string
          customer_id: string
          id: string
          message: string | null
          rental_id: string
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["reminder_status"]
          type: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          customer_id: string
          id?: string
          message?: string | null
          rental_id: string
          scheduled_for: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          type: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          customer_id?: string
          id?: string
          message?: string | null
          rental_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          auto_renew: boolean
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          closed_at: string | null
          closed_by: string | null
          closed_notes: string | null
          closed_reason: string | null
          contract_url: string | null
          created_at: string
          created_by: string | null
          crew: Json | null
          currency: string
          customer_id: string
          destination_address: string | null
          end_date: string
          grace_days: number
          id: string
          inventory: Json | null
          move_date: string | null
          move_time_end: string | null
          move_time_start: string | null
          pickup_address: string | null
          rate: number
          security_deposit: number | null
          service_notes: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          start_date: string
          status: Database["public"]["Enums"]["rental_status"]
          unit_id: string | null
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          auto_renew?: boolean
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          closed_at?: string | null
          closed_by?: string | null
          closed_notes?: string | null
          closed_reason?: string | null
          contract_url?: string | null
          created_at?: string
          created_by?: string | null
          crew?: Json | null
          currency?: string
          customer_id: string
          destination_address?: string | null
          end_date: string
          grace_days?: number
          id?: string
          inventory?: Json | null
          move_date?: string | null
          move_time_end?: string | null
          move_time_start?: string | null
          pickup_address?: string | null
          rate: number
          security_deposit?: number | null
          service_notes?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          start_date: string
          status?: Database["public"]["Enums"]["rental_status"]
          unit_id?: string | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          auto_renew?: boolean
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          closed_at?: string | null
          closed_by?: string | null
          closed_notes?: string | null
          closed_reason?: string | null
          contract_url?: string | null
          created_at?: string
          created_by?: string | null
          crew?: Json | null
          currency?: string
          customer_id?: string
          destination_address?: string | null
          end_date?: string
          grace_days?: number
          id?: string
          inventory?: Json | null
          move_date?: string | null
          move_time_end?: string | null
          move_time_start?: string | null
          pickup_address?: string | null
          rate?: number
          security_deposit?: number | null
          service_notes?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          start_date?: string
          status?: Database["public"]["Enums"]["rental_status"]
          unit_id?: string | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rentals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "storage_units"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          company_logo_url: string | null
          company_name: string
          currency: string
          id: number
          reminder_days_after: number[]
          reminder_days_before: number[]
          tax_rate: number
          updated_at: string
        }
        Insert: {
          company_logo_url?: string | null
          company_name?: string
          currency?: string
          id?: number
          reminder_days_after?: number[]
          reminder_days_before?: number[]
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          company_logo_url?: string | null
          company_name?: string
          currency?: string
          id?: number
          reminder_days_after?: number[]
          reminder_days_before?: number[]
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      storage_units: {
        Row: {
          climate_controlled: boolean
          created_at: string
          currency: string
          dimensions: string | null
          floor_level: number | null
          id: string
          image_url: string | null
          monthly_price: number
          name: string
          notes: string | null
          size: Database["public"]["Enums"]["unit_size"]
          status: Database["public"]["Enums"]["unit_status"]
          unit_code: string
          updated_at: string
          weekly_price: number | null
          yearly_price: number | null
        }
        Insert: {
          climate_controlled?: boolean
          created_at?: string
          currency?: string
          dimensions?: string | null
          floor_level?: number | null
          id?: string
          image_url?: string | null
          monthly_price?: number
          name: string
          notes?: string | null
          size?: Database["public"]["Enums"]["unit_size"]
          status?: Database["public"]["Enums"]["unit_status"]
          unit_code: string
          updated_at?: string
          weekly_price?: number | null
          yearly_price?: number | null
        }
        Update: {
          climate_controlled?: boolean
          created_at?: string
          currency?: string
          dimensions?: string | null
          floor_level?: number | null
          id?: string
          image_url?: string | null
          monthly_price?: number
          name?: string
          notes?: string | null
          size?: Database["public"]["Enums"]["unit_size"]
          status?: Database["public"]["Enums"]["unit_status"]
          unit_code?: string
          updated_at?: string
          weekly_price?: number | null
          yearly_price?: number | null
        }
        Relationships: []
      }
      stored_items: {
        Row: {
          condition: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          intake_date: string
          item_code: string
          name: string
          notes: string | null
          qty: number
          qty_released: number
          rental_id: string
          status: string
          updated_at: string
        }
        Insert: {
          condition?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          intake_date?: string
          item_code: string
          name: string
          notes?: string | null
          qty?: number
          qty_released?: number
          rental_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          condition?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          intake_date?: string
          item_code?: string
          name?: string
          notes?: string | null
          qty?: number
          qty_released?: number
          rental_id?: string
          status?: string
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_approve_payments: { Args: { _user_id: string }; Returns: boolean }
      claim_customer_link_code: { Args: { _code: string }; Returns: string }
      generate_customer_link_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      regenerate_customer_link_code: {
        Args: { _customer_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "staff"
        | "customer"
        | "payment_approver"
        | "super_admin"
      billing_cycle: "weekly" | "monthly" | "quarterly" | "yearly"
      customer_status: "active" | "inactive" | "blacklisted"
      document_kind: "contract" | "receipt" | "id" | "other" | "invoice"
      payment_method: "cash" | "pos" | "bank_transfer" | "online"
      payment_status:
        | "paid"
        | "partial"
        | "pending"
        | "failed"
        | "refunded"
        | "pending_approval"
      reminder_channel: "email" | "in_app" | "sms" | "whatsapp"
      reminder_status: "scheduled" | "sent" | "failed" | "cancelled"
      rental_status: "active" | "expired" | "overdue" | "cancelled"
      service_type: "storage" | "moving"
      unit_size: "small" | "medium" | "large" | "custom"
      unit_status: "vacant" | "occupied" | "reserved" | "maintenance"
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
      app_role: [
        "admin",
        "staff",
        "customer",
        "payment_approver",
        "super_admin",
      ],
      billing_cycle: ["weekly", "monthly", "quarterly", "yearly"],
      customer_status: ["active", "inactive", "blacklisted"],
      document_kind: ["contract", "receipt", "id", "other", "invoice"],
      payment_method: ["cash", "pos", "bank_transfer", "online"],
      payment_status: [
        "paid",
        "partial",
        "pending",
        "failed",
        "refunded",
        "pending_approval",
      ],
      reminder_channel: ["email", "in_app", "sms", "whatsapp"],
      reminder_status: ["scheduled", "sent", "failed", "cancelled"],
      rental_status: ["active", "expired", "overdue", "cancelled"],
      service_type: ["storage", "moving"],
      unit_size: ["small", "medium", "large", "custom"],
      unit_status: ["vacant", "occupied", "reserved", "maintenance"],
    },
  },
} as const
