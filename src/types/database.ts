export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          user_type: 'vendor' | 'client' | 'admin' | 'super_admin' | 'driver' | 'helpdesk' | null
          status: 'active' | 'pending' | 'deleted'
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          user_type?: 'vendor' | 'client' | 'admin' | 'super_admin' | 'driver' | 'helpdesk' | null
          status?: 'active' | 'pending' | 'deleted'
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          user_type?: 'vendor' | 'client' | 'admin' | 'super_admin' | 'driver' | 'helpdesk' | null
          status?: 'active' | 'pending' | 'deleted'
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      // Add other tables as needed
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 