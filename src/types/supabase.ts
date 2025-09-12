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
      // Add other tables as needed
      [key: string]: any
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
      // Add other enums as needed
      [key: string]: any
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
  Row: infer R
}
  ? R
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
  Insert: infer I
}
  ? I
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
  Update: infer U
}
  ? U
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"],
> = DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
