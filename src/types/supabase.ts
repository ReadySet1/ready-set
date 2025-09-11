export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      calculator_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          applies_when: string | null
          base_amount: number | null
          created_at: string
          id: string
          per_unit_amount: number | null
          priority: number | null
          rule_name: string
          rule_type: string
          template_id: string
          threshold_type: string | null
          threshold_value: number | null
          updated_at: string
        }
        Insert: {
          applies_when?: string | null
          base_amount?: number | null
          created_at?: string
          id?: string
          per_unit_amount?: number | null
          priority?: number | null
          rule_name: string
          rule_type: string
          template_id: string
          threshold_type?: string | null
          threshold_value?: number | null
          updated_at?: string
        }
        Update: {
          applies_when?: string | null
          base_amount?: number | null
          created_at?: string
          id?: string
          per_unit_amount?: number | null
          priority?: number | null
          rule_name?: string
          rule_type?: string
          template_id?: string
          threshold_type?: string | null
          threshold_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "calculator_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      client_configurations: {
        Row: {
          area_rules: Json | null
          client_id: string | null
          client_name: string
          created_at: string
          id: string
          is_active: boolean | null
          rule_overrides: Json | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          area_rules?: Json | null
          client_id?: string | null
          client_name: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          rule_overrides?: Json | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          area_rules?: Json | null
          client_id?: string | null
          client_name?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          rule_overrides?: Json | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_configurations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_configurations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "calculator_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      calculation_history: {
        Row: {
          client_config_id: string | null
          created_at: string
          customer_charges: Json
          customer_total: number
          driver_payments: Json
          driver_total: number
          id: string
          input_data: Json
          notes: string | null
          template_id: string | null
          user_id: string | null
        }
        Insert: {
          client_config_id?: string | null
          created_at?: string
          customer_charges: Json
          customer_total: number
          driver_payments: Json
          driver_total: number
          id?: string
          input_data: Json
          notes?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Update: {
          client_config_id?: string | null
          created_at?: string
          customer_charges?: Json
          customer_total?: number
          driver_payments?: Json
          driver_total?: number
          id?: string
          input_data?: Json
          notes?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calculation_history_client_config_id_fkey"
            columns: ["client_config_id"]
            isOneToOne: false
            referencedRelation: "client_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_history_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "calculator_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cateringBrokerage: string | null
          city: string | null
          companyName: string | null
          confirmationCode: string | null
          contactName: string | null
          contactNumber: string | null
          counties: Json | null
          createdAt: string
          deletedAt: string | null
          email: string
          frequency: string | null
          guid: string | null
          headCount: number | null
          id: string
          image: string | null
          isTemporaryPassword: boolean
          locationNumber: string | null
          name: string | null
          parkingLoading: string | null
          provide: string | null
          sideNotes: string | null
          state: string | null
          status: Database["public"]["Enums"]["UserStatus"]
          street1: string | null
          street2: string | null
          timeNeeded: string | null
          type: Database["public"]["Enums"]["UserType"]
          updatedAt: string
          website: string | null
          zip: string | null
        }
        Insert: {
          cateringBrokerage?: string | null
          city?: string | null
          companyName?: string | null
          confirmationCode?: string | null
          contactName?: string | null
          contactNumber?: string | null
          counties?: Json | null
          createdAt?: string
          deletedAt?: string | null
          email: string
          frequency?: string | null
          guid?: string | null
          headCount?: number | null
          id?: string
          image?: string | null
          isTemporaryPassword?: boolean
          locationNumber?: string | null
          name?: string | null
          parkingLoading?: string | null
          provide?: string | null
          sideNotes?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["UserStatus"]
          street1?: string | null
          street2?: string | null
          timeNeeded?: string | null
          type?: Database["public"]["Enums"]["UserType"]
          updatedAt?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          cateringBrokerage?: string | null
          city?: string | null
          companyName?: string | null
          confirmationCode?: string | null
          contactName?: string | null
          contactNumber?: string | null
          counties?: Json | null
          createdAt?: string
          deletedAt?: string | null
          email?: string
          frequency?: string | null
          guid?: string | null
          headCount?: number | null
          id?: string
          image?: string | null
          isTemporaryPassword?: boolean
          locationNumber?: string | null
          name?: string | null
          parkingLoading?: string | null
          provide?: string | null
          sideNotes?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["UserStatus"]
          street1?: string | null
          street2?: string | null
          timeNeeded?: string | null
          type?: Database["public"]["Enums"]["UserType"]
          updatedAt?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      UserStatus: "ACTIVE" | "PENDING" | "DELETED"
      UserType:
        | "VENDOR"
        | "CLIENT"
        | "DRIVER"
        | "ADMIN"
        | "HELPDESK"
        | "SUPER_ADMIN"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Calculator System Type Aliases for easy access
export type CalculatorTemplate = Database['public']['Tables']['calculator_templates']['Row']
export type CalculatorTemplateInsert = Database['public']['Tables']['calculator_templates']['Insert']
export type CalculatorTemplateUpdate = Database['public']['Tables']['calculator_templates']['Update']

export type PricingRule = Database['public']['Tables']['pricing_rules']['Row']
export type PricingRuleInsert = Database['public']['Tables']['pricing_rules']['Insert']
export type PricingRuleUpdate = Database['public']['Tables']['pricing_rules']['Update']

export type ClientConfiguration = Database['public']['Tables']['client_configurations']['Row']
export type ClientConfigurationInsert = Database['public']['Tables']['client_configurations']['Insert']
export type ClientConfigurationUpdate = Database['public']['Tables']['client_configurations']['Update']

export type CalculationHistory = Database['public']['Tables']['calculation_history']['Row']
export type CalculationHistoryInsert = Database['public']['Tables']['calculation_history']['Insert']
export type CalculationHistoryUpdate = Database['public']['Tables']['calculation_history']['Update']

// Type aliases for other important tables
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'] 