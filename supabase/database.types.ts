/**
 * Supabase Database TypeScript Types
 * Generated from schema analysis - Migration Reconciliation
 * Last Updated: 2025-10-14
 *
 * This file contains TypeScript type definitions for all tables,
 * including newly added audit and error tracking tables.
 *
 * To regenerate from production after migration:
 * supabase gen types typescript --project-id jiasmmmmhtreoacdpiby > database.types.ts
 */

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
      // ============================================================================
      // NEW: User Audits Table (Added by migration 20251014220000)
      // ============================================================================
      user_audits: {
        Row: {
          id: string
          userId: string
          action: string
          performedBy: string | null
          changes: Json | null
          reason: string | null
          metadata: Json | null
          createdAt: string
        }
        Insert: {
          id?: string
          userId: string
          action: string
          performedBy?: string | null
          changes?: Json | null
          reason?: string | null
          metadata?: Json | null
          createdAt?: string
        }
        Update: {
          id?: string
          userId?: string
          action?: string
          performedBy?: string | null
          changes?: Json | null
          reason?: string | null
          metadata?: Json | null
          createdAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_audits_userId_fkey"
            columns: ["userId"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_audits_performedBy_fkey"
            columns: ["performedBy"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================================================
      // NEW: Upload Errors Table (Added by migration 20251014220100)
      // ============================================================================
      upload_errors: {
        Row: {
          id: string
          correlationId: string
          errorType: string
          message: string
          userMessage: string
          details: string | null
          userId: string | null
          timestamp: string
          retryable: boolean
          resolved: boolean
        }
        Insert: {
          id?: string
          correlationId: string
          errorType: string
          message: string
          userMessage: string
          details?: string | null
          userId?: string | null
          timestamp?: string
          retryable?: boolean
          resolved?: boolean
        }
        Update: {
          id?: string
          correlationId?: string
          errorType?: string
          message?: string
          userMessage?: string
          details?: string | null
          userId?: string | null
          timestamp?: string
          retryable?: boolean
          resolved?: boolean
        }
        Relationships: []
      }

      // ============================================================================
      // ENHANCED: Profiles Table (Updated by migration 20251014220000)
      // ============================================================================
      profiles: {
        Row: {
          id: string
          guid: string | null
          name: string | null
          email: string
          image: string | null
          type: Database["public"]["Enums"]["UserType"]
          companyName: string | null
          contactName: string | null
          contactNumber: string | null
          website: string | null
          street1: string | null
          street2: string | null
          city: string | null
          state: string | null
          zip: string | null
          locationNumber: string | null
          parkingLoading: string | null
          counties: Json | null
          timeNeeded: string | null
          cateringBrokerage: string | null
          frequency: string | null
          provide: string | null
          headCount: number | null
          status: Database["public"]["Enums"]["UserStatus"]
          sideNotes: string | null
          confirmationCode: string | null
          createdAt: string
          updatedAt: string
          isTemporaryPassword: boolean
          deletedAt: string | null
          deletedBy: string | null // NEW: Added by migration
          deletionReason: string | null // NEW: Added by migration
        }
        Insert: {
          id?: string
          guid?: string | null
          name?: string | null
          email: string
          image?: string | null
          type?: Database["public"]["Enums"]["UserType"]
          companyName?: string | null
          contactName?: string | null
          contactNumber?: string | null
          website?: string | null
          street1?: string | null
          street2?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          locationNumber?: string | null
          parkingLoading?: string | null
          counties?: Json | null
          timeNeeded?: string | null
          cateringBrokerage?: string | null
          frequency?: string | null
          provide?: string | null
          headCount?: number | null
          status?: Database["public"]["Enums"]["UserStatus"]
          sideNotes?: string | null
          confirmationCode?: string | null
          createdAt?: string
          updatedAt?: string
          isTemporaryPassword?: boolean
          deletedAt?: string | null
          deletedBy?: string | null
          deletionReason?: string | null
        }
        Update: {
          id?: string
          guid?: string | null
          name?: string | null
          email?: string
          image?: string | null
          type?: Database["public"]["Enums"]["UserType"]
          companyName?: string | null
          contactName?: string | null
          contactNumber?: string | null
          website?: string | null
          street1?: string | null
          street2?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          locationNumber?: string | null
          parkingLoading?: string | null
          counties?: Json | null
          timeNeeded?: string | null
          cateringBrokerage?: string | null
          frequency?: string | null
          provide?: string | null
          headCount?: number | null
          status?: Database["public"]["Enums"]["UserStatus"]
          sideNotes?: string | null
          confirmationCode?: string | null
          createdAt?: string
          updatedAt?: string
          isTemporaryPassword?: boolean
          deletedAt?: string | null
          deletedBy?: string | null
          deletionReason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_deletedBy_fkey"
            columns: ["deletedBy"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }

      // ============================================================================
      // Existing Tables (unchanged)
      // ============================================================================

      addresses: {
        Row: {
          id: string
          county: string | null
          street1: string
          street2: string | null
          city: string
          state: string
          zip: string
          createdAt: string
          createdBy: string | null
          isRestaurant: boolean
          isShared: boolean
          locationNumber: string | null
          parkingLoading: string | null
          updatedAt: string
          name: string | null
          latitude: number | null
          longitude: number | null
          deletedAt: string | null
        }
        Insert: {
          id?: string
          county?: string | null
          street1: string
          street2?: string | null
          city: string
          state: string
          zip: string
          createdAt?: string
          createdBy?: string | null
          isRestaurant?: boolean
          isShared?: boolean
          locationNumber?: string | null
          parkingLoading?: string | null
          updatedAt?: string
          name?: string | null
          latitude?: number | null
          longitude?: number | null
          deletedAt?: string | null
        }
        Update: {
          id?: string
          county?: string | null
          street1?: string
          street2?: string | null
          city?: string
          state?: string
          zip?: string
          createdAt?: string
          createdBy?: string | null
          isRestaurant?: boolean
          isShared?: boolean
          locationNumber?: string | null
          parkingLoading?: string | null
          updatedAt?: string
          name?: string | null
          latitude?: number | null
          longitude?: number | null
          deletedAt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_createdBy_fkey"
            columns: ["createdBy"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }

      address_favorites: {
        Row: {
          id: string
          user_id: string
          address_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          address_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          address_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "address_favorites_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "address_favorites_address_id_fkey"
            columns: ["address_id"]
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          }
        ]
      }

      address_usage_history: {
        Row: {
          id: string
          user_id: string
          address_id: string
          used_at: string
          context: "pickup" | "delivery" | "order" | null
        }
        Insert: {
          id?: string
          user_id: string
          address_id: string
          used_at?: string
          context?: "pickup" | "delivery" | "order" | null
        }
        Update: {
          id?: string
          user_id?: string
          address_id?: string
          used_at?: string
          context?: "pickup" | "delivery" | "order" | null
        }
        Relationships: [
          {
            foreignKeyName: "address_usage_history_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "address_usage_history_address_id_fkey"
            columns: ["address_id"]
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          }
        ]
      }

      catering_requests: {
        Row: {
          id: string
          guid: string | null
          userId: string
          pickupAddressId: string
          deliveryAddressId: string
          brokerage: string | null
          orderNumber: string
          pickupDateTime: string | null
          arrivalDateTime: string | null
          completeDateTime: string | null
          headcount: number | null
          needHost: Database["public"]["Enums"]["CateringNeedHost"]
          hoursNeeded: number | null
          numberOfHosts: number | null
          clientAttention: string | null
          pickupNotes: string | null
          specialNotes: string | null
          image: string | null
          status: Database["public"]["Enums"]["CateringStatus"]
          orderTotal: number
          tip: number
          appliedDiscount: number | null
          pricingTierId: string | null
          createdAt: string
          updatedAt: string
          driverStatus: Database["public"]["Enums"]["DriverStatus"] | null
          deletedAt: string | null
        }
        Insert: {
          id?: string
          guid?: string | null
          userId: string
          pickupAddressId: string
          deliveryAddressId: string
          brokerage?: string | null
          orderNumber: string
          pickupDateTime?: string | null
          arrivalDateTime?: string | null
          completeDateTime?: string | null
          headcount?: number | null
          needHost?: Database["public"]["Enums"]["CateringNeedHost"]
          hoursNeeded?: number | null
          numberOfHosts?: number | null
          clientAttention?: string | null
          pickupNotes?: string | null
          specialNotes?: string | null
          image?: string | null
          status?: Database["public"]["Enums"]["CateringStatus"]
          orderTotal?: number
          tip?: number
          appliedDiscount?: number | null
          pricingTierId?: string | null
          createdAt?: string
          updatedAt?: string
          driverStatus?: Database["public"]["Enums"]["DriverStatus"] | null
          deletedAt?: string | null
        }
        Update: {
          id?: string
          guid?: string | null
          userId?: string
          pickupAddressId?: string
          deliveryAddressId?: string
          brokerage?: string | null
          orderNumber?: string
          pickupDateTime?: string | null
          arrivalDateTime?: string | null
          completeDateTime?: string | null
          headcount?: number | null
          needHost?: Database["public"]["Enums"]["CateringNeedHost"]
          hoursNeeded?: number | null
          numberOfHosts?: number | null
          clientAttention?: string | null
          pickupNotes?: string | null
          specialNotes?: string | null
          image?: string | null
          status?: Database["public"]["Enums"]["CateringStatus"]
          orderTotal?: number
          tip?: number
          appliedDiscount?: number | null
          pricingTierId?: string | null
          createdAt?: string
          updatedAt?: string
          driverStatus?: Database["public"]["Enums"]["DriverStatus"] | null
          deletedAt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catering_requests_userId_fkey"
            columns: ["userId"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_requests_pickupAddressId_fkey"
            columns: ["pickupAddressId"]
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_requests_deliveryAddressId_fkey"
            columns: ["deliveryAddressId"]
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_requests_pricingTierId_fkey"
            columns: ["pricingTierId"]
            referencedRelation: "pricing_tiers"
            referencedColumns: ["id"]
          }
        ]
      }

      delivery_configurations: {
        Row: {
          id: string
          config_id: string
          client_name: string
          vendor_name: string
          description: string | null
          is_active: boolean
          pricing_tiers: Json
          mileage_rate: number
          distance_threshold: number
          daily_drive_discounts: Json
          driver_pay_settings: Json
          bridge_toll_settings: Json
          custom_settings: Json | null
          created_at: string
          updated_at: string
          created_by: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          config_id: string
          client_name: string
          vendor_name: string
          description?: string | null
          is_active?: boolean
          pricing_tiers: Json
          mileage_rate: number
          distance_threshold: number
          daily_drive_discounts: Json
          driver_pay_settings: Json
          bridge_toll_settings: Json
          custom_settings?: Json | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          config_id?: string
          client_name?: string
          vendor_name?: string
          description?: string | null
          is_active?: boolean
          pricing_tiers?: Json
          mileage_rate?: number
          distance_threshold?: number
          daily_drive_discounts?: Json
          driver_pay_settings?: Json
          bridge_toll_settings?: Json
          custom_settings?: Json | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          notes?: string | null
        }
        Relationships: []
      }
    }

    Views: {
      upload_error_stats: {
        Row: {
          errorType: string
          total_count: number
          unresolved_count: number
          retryable_count: number
          affected_users: number
          first_occurrence: string
          last_occurrence: string
          avg_hours_to_resolve: number
        }
      }
    }

    Functions: {
      log_upload_error: {
        Args: {
          p_correlation_id: string
          p_error_type: string
          p_message: string
          p_user_message: string
          p_details?: string
          p_user_id?: string
          p_retryable?: boolean
        }
        Returns: string
      }
      resolve_upload_error: {
        Args: {
          p_error_id: string
          p_resolved_by?: string
        }
        Returns: boolean
      }
      cleanup_old_upload_errors: {
        Args: {
          p_days_to_keep?: number
        }
        Returns: number
      }
    }

    Enums: {
      UserType: "VENDOR" | "CLIENT" | "DRIVER" | "ADMIN" | "HELPDESK" | "SUPER_ADMIN"
      UserStatus: "ACTIVE" | "PENDING" | "DELETED"
      CateringNeedHost: "YES" | "NO"
      CateringStatus: "ACTIVE" | "ASSIGNED" | "CANCELLED" | "COMPLETED" | "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "DELIVERED"
      OnDemandStatus: "ACTIVE" | "ASSIGNED" | "CANCELLED" | "COMPLETED" | "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "DELIVERED"
      DriverStatus: "ARRIVED_AT_VENDOR" | "EN_ROUTE_TO_CLIENT" | "ARRIVED_TO_CLIENT" | "ASSIGNED" | "COMPLETED"
      VehicleType: "CAR" | "VAN" | "TRUCK"
      ApplicationStatus: "PENDING" | "APPROVED" | "REJECTED" | "INTERVIEWING"
      FormType: "FOOD" | "FLOWER" | "BAKERY" | "SPECIALTY"
      TestimonialCategory: "CLIENTS" | "VENDORS" | "DRIVERS"
    }

    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ============================================================================
// Type Aliases for Common Use Cases
// ============================================================================

export type UserAudit = Database["public"]["Tables"]["user_audits"]["Row"]
export type UserAuditInsert = Database["public"]["Tables"]["user_audits"]["Insert"]
export type UserAuditUpdate = Database["public"]["Tables"]["user_audits"]["Update"]

export type UploadError = Database["public"]["Tables"]["upload_errors"]["Row"]
export type UploadErrorInsert = Database["public"]["Tables"]["upload_errors"]["Insert"]
export type UploadErrorUpdate = Database["public"]["Tables"]["upload_errors"]["Update"]

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"]
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"]

export type Address = Database["public"]["Tables"]["addresses"]["Row"]
export type AddressInsert = Database["public"]["Tables"]["addresses"]["Insert"]
export type AddressUpdate = Database["public"]["Tables"]["addresses"]["Update"]

export type CateringRequest = Database["public"]["Tables"]["catering_requests"]["Row"]
export type CateringRequestInsert = Database["public"]["Tables"]["catering_requests"]["Insert"]
export type CateringRequestUpdate = Database["public"]["Tables"]["catering_requests"]["Update"]

// Enums
export type UserType = Database["public"]["Enums"]["UserType"]
export type UserStatus = Database["public"]["Enums"]["UserStatus"]
export type CateringStatus = Database["public"]["Enums"]["CateringStatus"]
export type DriverStatus = Database["public"]["Enums"]["DriverStatus"]
