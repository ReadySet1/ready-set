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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          accessToken: string | null
          expiresAt: number | null
          id: string
          idToken: string | null
          provider: string
          providerAccountId: string
          refreshToken: string | null
          scope: string | null
          sessionState: string | null
          tokenType: string | null
          type: string
          userId: string
        }
        Insert: {
          accessToken?: string | null
          expiresAt?: number | null
          id: string
          idToken?: string | null
          provider: string
          providerAccountId: string
          refreshToken?: string | null
          scope?: string | null
          sessionState?: string | null
          tokenType?: string | null
          type: string
          userId: string
        }
        Update: {
          accessToken?: string | null
          expiresAt?: number | null
          id?: string
          idToken?: string | null
          provider?: string
          providerAccountId?: string
          refreshToken?: string | null
          scope?: string | null
          sessionState?: string | null
          tokenType?: string | null
          type?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          city: string
          county: string | null
          createdAt: string
          createdBy: string | null
          deletedAt: string | null
          id: string
          isRestaurant: boolean
          isShared: boolean
          latitude: number | null
          locationNumber: string | null
          longitude: number | null
          name: string | null
          parkingLoading: string | null
          state: string
          street1: string
          street2: string | null
          updatedAt: string
          zip: string
        }
        Insert: {
          city: string
          county?: string | null
          createdAt?: string
          createdBy?: string | null
          deletedAt?: string | null
          id: string
          isRestaurant?: boolean
          isShared?: boolean
          latitude?: number | null
          locationNumber?: string | null
          longitude?: number | null
          name?: string | null
          parkingLoading?: string | null
          state: string
          street1: string
          street2?: string | null
          updatedAt: string
          zip: string
        }
        Update: {
          city?: string
          county?: string | null
          createdAt?: string
          createdBy?: string | null
          deletedAt?: string | null
          id?: string
          isRestaurant?: boolean
          isShared?: boolean
          latitude?: number | null
          locationNumber?: string | null
          longitude?: number | null
          name?: string | null
          parkingLoading?: string | null
          state?: string
          street1?: string
          street2?: string | null
          updatedAt?: string
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_createdBy_fkey"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      catering_requests: {
        Row: {
          appliedDiscount: number | null
          arrivalDateTime: string | null
          brokerage: string | null
          clientAttention: string | null
          completeDateTime: string | null
          createdAt: string
          deletedAt: string | null
          deliveryAddressId: string
          driverStatus: Database["public"]["Enums"]["DriverStatus"] | null
          guid: string | null
          headcount: number | null
          hoursNeeded: number | null
          id: string
          image: string | null
          needHost: Database["public"]["Enums"]["CateringNeedHost"]
          numberOfHosts: number | null
          orderNumber: string
          orderTotal: number | null
          pickupAddressId: string
          pickupDateTime: string | null
          pickupNotes: string | null
          pricingTierId: string | null
          specialNotes: string | null
          status: Database["public"]["Enums"]["CateringStatus"]
          tip: number | null
          updatedAt: string
          userId: string
        }
        Insert: {
          appliedDiscount?: number | null
          arrivalDateTime?: string | null
          brokerage?: string | null
          clientAttention?: string | null
          completeDateTime?: string | null
          createdAt?: string
          deletedAt?: string | null
          deliveryAddressId: string
          driverStatus?: Database["public"]["Enums"]["DriverStatus"] | null
          guid?: string | null
          headcount?: number | null
          hoursNeeded?: number | null
          id: string
          image?: string | null
          needHost?: Database["public"]["Enums"]["CateringNeedHost"]
          numberOfHosts?: number | null
          orderNumber: string
          orderTotal?: number | null
          pickupAddressId: string
          pickupDateTime?: string | null
          pickupNotes?: string | null
          pricingTierId?: string | null
          specialNotes?: string | null
          status?: Database["public"]["Enums"]["CateringStatus"]
          tip?: number | null
          updatedAt: string
          userId: string
        }
        Update: {
          appliedDiscount?: number | null
          arrivalDateTime?: string | null
          brokerage?: string | null
          clientAttention?: string | null
          completeDateTime?: string | null
          createdAt?: string
          deletedAt?: string | null
          deliveryAddressId?: string
          driverStatus?: Database["public"]["Enums"]["DriverStatus"] | null
          guid?: string | null
          headcount?: number | null
          hoursNeeded?: number | null
          id?: string
          image?: string | null
          needHost?: Database["public"]["Enums"]["CateringNeedHost"]
          numberOfHosts?: number | null
          orderNumber?: string
          orderTotal?: number | null
          pickupAddressId?: string
          pickupDateTime?: string | null
          pickupNotes?: string | null
          pricingTierId?: string | null
          specialNotes?: string | null
          status?: Database["public"]["Enums"]["CateringStatus"]
          tip?: number | null
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "catering_requests_deliveryAddressId_fkey"
            columns: ["deliveryAddressId"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_requests_pickupAddressId_fkey"
            columns: ["pickupAddressId"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_requests_pricingTierId_fkey"
            columns: ["pricingTierId"]
            isOneToOne: false
            referencedRelation: "pricing_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_requests_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calculator_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_configurations: {
        Row: {
          id: string
          client_id: string | null
          template_id: string
          client_name: string
          rule_overrides: Json
          area_rules: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          client_id?: string | null
          template_id: string
          client_name: string
          rule_overrides?: Json
          area_rules?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string | null
          template_id?: string
          client_name?: string
          rule_overrides?: Json
          area_rules?: Json
          is_active?: boolean
          created_at?: string
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
          }
        ]
      }
      pricing_rules: {
        Row: {
          id: string
          template_id: string
          rule_type: string
          rule_name: string
          base_amount: number | null
          per_unit_amount: number | null
          threshold_value: number | null
          threshold_type: string | null
          applies_when: string | null
          priority: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          template_id: string
          rule_type: string
          rule_name: string
          base_amount?: number | null
          per_unit_amount?: number | null
          threshold_value?: number | null
          threshold_type?: string | null
          applies_when?: string | null
          priority?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          rule_type?: string
          rule_name?: string
          base_amount?: number | null
          per_unit_amount?: number | null
          threshold_value?: number | null
          threshold_type?: string | null
          applies_when?: string | null
          priority?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "calculator_templates"
            referencedColumns: ["id"]
          }
        ]
      }
      dispatches: {
        Row: {
          cateringRequestId: string | null
          createdAt: string
          driverId: string | null
          id: string
          onDemandId: string | null
          updatedAt: string
          userId: string | null
        }
        Insert: {
          cateringRequestId?: string | null
          createdAt?: string
          driverId?: string | null
          id: string
          onDemandId?: string | null
          updatedAt: string
          userId?: string | null
        }
        Update: {
          cateringRequestId?: string | null
          createdAt?: string
          driverId?: string | null
          id?: string
          onDemandId?: string | null
          updatedAt?: string
          userId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatches_cateringRequestId_fkey"
            columns: ["cateringRequestId"]
            isOneToOne: false
            referencedRelation: "catering_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_driverId_fkey"
            columns: ["driverId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_onDemandId_fkey"
            columns: ["onDemandId"]
            isOneToOne: false
            referencedRelation: "on_demand_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      file_uploads: {
        Row: {
          category: string | null
          cateringRequestId: string | null
          fileName: string
          fileSize: number
          fileType: string
          fileUrl: string
          id: string
          isTemporary: boolean
          jobApplicationId: string | null
          onDemandId: string | null
          updatedAt: string
          uploadedAt: string
          userId: string | null
        }
        Insert: {
          category?: string | null
          cateringRequestId?: string | null
          fileName: string
          fileSize: number
          fileType: string
          fileUrl: string
          id: string
          isTemporary?: boolean
          jobApplicationId?: string | null
          onDemandId?: string | null
          updatedAt: string
          uploadedAt?: string
          userId?: string | null
        }
        Update: {
          category?: string | null
          cateringRequestId?: string | null
          fileName?: string
          fileSize?: number
          fileType?: string
          fileUrl?: string
          id?: string
          isTemporary?: boolean
          jobApplicationId?: string | null
          onDemandId?: string | null
          updatedAt?: string
          uploadedAt?: string
          userId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_uploads_cateringRequestId_fkey"
            columns: ["cateringRequestId"]
            isOneToOne: false
            referencedRelation: "catering_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_uploads_jobApplicationId_fkey"
            columns: ["jobApplicationId"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_uploads_onDemandId_fkey"
            columns: ["onDemandId"]
            isOneToOne: false
            referencedRelation: "on_demand_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_uploads_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          additionalComments: string
          companyName: string
          contactName: string
          counties: Json
          createdAt: string
          email: string
          formType: Database["public"]["Enums"]["FormType"]
          frequency: string
          id: string
          phone: string
          pickupAddress: Json
          specifications: string
          updatedAt: string
          website: string
        }
        Insert: {
          additionalComments: string
          companyName: string
          contactName: string
          counties: Json
          createdAt?: string
          email: string
          formType: Database["public"]["Enums"]["FormType"]
          frequency: string
          id: string
          phone: string
          pickupAddress: Json
          specifications: string
          updatedAt: string
          website: string
        }
        Update: {
          additionalComments?: string
          companyName?: string
          contactName?: string
          counties?: Json
          createdAt?: string
          email?: string
          formType?: Database["public"]["Enums"]["FormType"]
          frequency?: string
          id?: string
          phone?: string
          pickupAddress?: Json
          specifications?: string
          updatedAt?: string
          website?: string
        }
        Relationships: []
      }
      application_sessions: {
        Row: {
          id: string
          email: string | null
          first_name: string | null
          last_name: string | null
          role: string | null
          verification_code: string | null
          code_expires_at: string | null
          verified: boolean
          session_token: string
          session_expires_at: string
          uploaded_files: string[]
          upload_count: number
          max_uploads: number
          ip_address: string | null
          user_agent: string | null
          created_at: string
          last_activity_at: string
          completed: boolean
          job_application_id: string | null
        }
        Insert: {
          id?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          role?: string | null
          verification_code?: string | null
          code_expires_at?: string | null
          verified?: boolean
          session_token: string
          session_expires_at: string
          uploaded_files?: string[]
          upload_count?: number
          max_uploads?: number
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
          last_activity_at?: string
          completed?: boolean
          job_application_id?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          role?: string | null
          verification_code?: string | null
          code_expires_at?: string | null
          verified?: boolean
          session_token?: string
          session_expires_at?: string
          uploaded_files?: string[]
          upload_count?: number
          max_uploads?: number
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
          last_activity_at?: string
          completed?: boolean
          job_application_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_sessions_job_application_id_fkey"
            columns: ["job_application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          addressCity: string
          addressState: string
          addressStreet: string
          addressZip: string
          carPhotoFilePath: string | null
          coverLetter: string | null
          createdAt: string
          deletedAt: string | null
          driverPhotoFilePath: string | null
          driversLicenseFilePath: string | null
          education: string | null
          email: string
          equipmentPhotoFilePath: string | null
          firstName: string
          foodHandlerFilePath: string | null
          hipaaFilePath: string | null
          id: string
          insuranceFilePath: string | null
          lastName: string
          phone: string | null
          position: string
          profileId: string | null
          resumeFilePath: string | null
          skills: string | null
          status: Database["public"]["Enums"]["ApplicationStatus"]
          updatedAt: string
          vehicleRegFilePath: string | null
          workExperience: string | null
        }
        Insert: {
          addressCity: string
          addressState: string
          addressStreet: string
          addressZip: string
          carPhotoFilePath?: string | null
          coverLetter?: string | null
          createdAt?: string
          deletedAt?: string | null
          driverPhotoFilePath?: string | null
          driversLicenseFilePath?: string | null
          education?: string | null
          email: string
          equipmentPhotoFilePath?: string | null
          firstName: string
          foodHandlerFilePath?: string | null
          hipaaFilePath?: string | null
          id: string
          insuranceFilePath?: string | null
          lastName: string
          phone?: string | null
          position: string
          profileId?: string | null
          resumeFilePath?: string | null
          skills?: string | null
          status?: Database["public"]["Enums"]["ApplicationStatus"]
          updatedAt: string
          vehicleRegFilePath?: string | null
          workExperience?: string | null
        }
        Update: {
          addressCity?: string
          addressState?: string
          addressStreet?: string
          addressZip?: string
          carPhotoFilePath?: string | null
          coverLetter?: string | null
          createdAt?: string
          deletedAt?: string | null
          driverPhotoFilePath?: string | null
          driversLicenseFilePath?: string | null
          education?: string | null
          email?: string
          equipmentPhotoFilePath?: string | null
          firstName?: string
          foodHandlerFilePath?: string | null
          hipaaFilePath?: string | null
          id?: string
          insuranceFilePath?: string | null
          lastName?: string
          phone?: string | null
          position?: string
          profileId?: string | null
          resumeFilePath?: string | null
          skills?: string | null
          status?: Database["public"]["Enums"]["ApplicationStatus"]
          updatedAt?: string
          vehicleRegFilePath?: string | null
          workExperience?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_profileId_fkey"
            columns: ["profileId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_captures: {
        Row: {
          createdAt: string
          email: string
          firstName: string
          id: string
          industry: string
          lastName: string
          newsletterConsent: boolean
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          email: string
          firstName: string
          id: string
          industry: string
          lastName: string
          newsletterConsent?: boolean
          updatedAt: string
        }
        Update: {
          createdAt?: string
          email?: string
          firstName?: string
          id?: string
          industry?: string
          lastName?: string
          newsletterConsent?: boolean
          updatedAt?: string
        }
        Relationships: []
      }
      on_demand_requests: {
        Row: {
          arrivalDateTime: string
          clientAttention: string
          completeDateTime: string | null
          createdAt: string
          deletedAt: string | null
          deliveryAddressId: string
          driverStatus: Database["public"]["Enums"]["DriverStatus"] | null
          guid: string | null
          height: number | null
          hoursNeeded: number | null
          id: string
          image: string | null
          itemDelivered: string | null
          length: number | null
          orderNumber: string
          orderTotal: number | null
          pickupAddressId: string
          pickupDateTime: string
          pickupNotes: string | null
          specialNotes: string | null
          status: Database["public"]["Enums"]["OnDemandStatus"]
          tip: number | null
          updatedAt: string
          userId: string
          vehicleType: Database["public"]["Enums"]["VehicleType"]
          weight: number | null
          width: number | null
        }
        Insert: {
          arrivalDateTime: string
          clientAttention: string
          completeDateTime?: string | null
          createdAt?: string
          deletedAt?: string | null
          deliveryAddressId: string
          driverStatus?: Database["public"]["Enums"]["DriverStatus"] | null
          guid?: string | null
          height?: number | null
          hoursNeeded?: number | null
          id: string
          image?: string | null
          itemDelivered?: string | null
          length?: number | null
          orderNumber: string
          orderTotal?: number | null
          pickupAddressId: string
          pickupDateTime: string
          pickupNotes?: string | null
          specialNotes?: string | null
          status?: Database["public"]["Enums"]["OnDemandStatus"]
          tip?: number | null
          updatedAt: string
          userId: string
          vehicleType?: Database["public"]["Enums"]["VehicleType"]
          weight?: number | null
          width?: number | null
        }
        Update: {
          arrivalDateTime?: string
          clientAttention?: string
          completeDateTime?: string | null
          createdAt?: string
          deletedAt?: string | null
          deliveryAddressId?: string
          driverStatus?: Database["public"]["Enums"]["DriverStatus"] | null
          guid?: string | null
          height?: number | null
          hoursNeeded?: number | null
          id?: string
          image?: string | null
          itemDelivered?: string | null
          length?: number | null
          orderNumber?: string
          orderTotal?: number | null
          pickupAddressId?: string
          pickupDateTime?: string
          pickupNotes?: string | null
          specialNotes?: string | null
          status?: Database["public"]["Enums"]["OnDemandStatus"]
          tip?: number | null
          updatedAt?: string
          userId?: string
          vehicleType?: Database["public"]["Enums"]["VehicleType"]
          weight?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "on_demand_requests_deliveryAddressId_fkey"
            columns: ["deliveryAddressId"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_demand_requests_pickupAddressId_fkey"
            columns: ["pickupAddressId"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_demand_requests_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tiers: {
        Row: {
          createdAt: string
          id: string
          isActive: boolean
          maxFoodCost: number | null
          maxHeadCount: number | null
          minFoodCost: number
          minHeadCount: number
          percentageWithoutTip: number | null
          percentageWithTip: number | null
          priceWithoutTip: number | null
          priceWithTip: number | null
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          id: string
          isActive?: boolean
          maxFoodCost?: number | null
          maxHeadCount?: number | null
          minFoodCost: number
          minHeadCount: number
          percentageWithoutTip?: number | null
          percentageWithTip?: number | null
          priceWithoutTip?: number | null
          priceWithTip?: number | null
          updatedAt: string
        }
        Update: {
          createdAt?: string
          id?: string
          isActive?: boolean
          maxFoodCost?: number | null
          maxHeadCount?: number | null
          minFoodCost?: number
          minHeadCount?: number
          percentageWithoutTip?: number | null
          percentageWithTip?: number | null
          priceWithoutTip?: number | null
          priceWithTip?: number | null
          updatedAt?: string
        }
        Relationships: []
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
          deletedBy: string | null
          deletionReason: string | null
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
          deletedBy?: string | null
          deletionReason?: string | null
          email: string
          frequency?: string | null
          guid?: string | null
          headCount?: number | null
          id: string
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
          updatedAt: string
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
          deletedBy?: string | null
          deletionReason?: string | null
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
        Relationships: [
          {
            foreignKeyName: "profiles_deletedBy_fkey"
            columns: ["deletedBy"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          expires: string
          id: string
          sessionToken: string
          userId: string
        }
        Insert: {
          expires: string
          id: string
          sessionToken: string
          userId: string
        }
        Update: {
          expires?: string
          id?: string
          sessionToken?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          image: string | null
          is_active: boolean | null
          name: string
          rating: number | null
          role: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string | null
          id?: string
          image?: string | null
          is_active?: boolean | null
          name: string
          rating?: number | null
          role?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          image?: string | null
          is_active?: boolean | null
          name?: string
          rating?: number | null
          role?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_addresses: {
        Row: {
          addressId: string
          alias: string | null
          createdAt: string
          id: string
          isDefault: boolean
          updatedAt: string
          userId: string
        }
        Insert: {
          addressId: string
          alias?: string | null
          createdAt?: string
          id: string
          isDefault?: boolean
          updatedAt: string
          userId: string
        }
        Update: {
          addressId?: string
          alias?: string | null
          createdAt?: string
          id?: string
          isDefault?: boolean
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_addresses_addressId_fkey"
            columns: ["addressId"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_addresses_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_audits: {
        Row: {
          action: string
          changes: Json | null
          createdAt: string
          id: string
          metadata: Json | null
          performedBy: string | null
          reason: string | null
          userId: string
        }
        Insert: {
          action: string
          changes?: Json | null
          createdAt?: string
          id: string
          metadata?: Json | null
          performedBy?: string | null
          reason?: string | null
          userId: string
        }
        Update: {
          action?: string
          changes?: Json | null
          createdAt?: string
          id?: string
          metadata?: Json | null
          performedBy?: string | null
          reason?: string | null
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_audits_performedBy_fkey"
            columns: ["performedBy"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_audits_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_tokens: {
        Row: {
          expires: string
          id: string
          identifier: string
          token: string
        }
        Insert: {
          expires: string
          id: string
          identifier: string
          token: string
        }
        Update: {
          expires?: string
          id?: string
          identifier?: string
          token?: string
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
      ApplicationStatus: "PENDING" | "APPROVED" | "REJECTED" | "INTERVIEWING"
      CateringNeedHost: "YES" | "NO"
      CateringStatus:
        | "ACTIVE"
        | "ASSIGNED"
        | "CANCELLED"
        | "COMPLETED"
        | "PENDING"
        | "CONFIRMED"
        | "IN_PROGRESS"
        | "DELIVERED"
      DriverStatus:
        | "ARRIVED_AT_VENDOR"
        | "EN_ROUTE_TO_CLIENT"
        | "ARRIVED_TO_CLIENT"
        | "ASSIGNED"
        | "COMPLETED"
      FormType: "FOOD" | "FLOWER" | "BAKERY" | "SPECIALTY"
      OnDemandStatus:
        | "ACTIVE"
        | "ASSIGNED"
        | "CANCELLED"
        | "COMPLETED"
        | "PENDING"
        | "CONFIRMED"
        | "IN_PROGRESS"
        | "DELIVERED"
      UserStatus: "ACTIVE" | "PENDING" | "DELETED"
      UserType:
        | "VENDOR"
        | "CLIENT"
        | "DRIVER"
        | "ADMIN"
        | "HELPDESK"
        | "SUPER_ADMIN"
      VehicleType: "CAR" | "VAN" | "TRUCK"
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
      ApplicationStatus: ["PENDING", "APPROVED", "REJECTED", "INTERVIEWING"],
      CateringNeedHost: ["YES", "NO"],
      CateringStatus: [
        "ACTIVE",
        "ASSIGNED",
        "CANCELLED",
        "COMPLETED",
        "PENDING",
        "CONFIRMED",
        "IN_PROGRESS",
        "DELIVERED",
      ],
      DriverStatus: [
        "ARRIVED_AT_VENDOR",
        "EN_ROUTE_TO_CLIENT",
        "ARRIVED_TO_CLIENT",
        "ASSIGNED",
        "COMPLETED",
      ],
      FormType: ["FOOD", "FLOWER", "BAKERY", "SPECIALTY"],
      OnDemandStatus: [
        "ACTIVE",
        "ASSIGNED",
        "CANCELLED",
        "COMPLETED",
        "PENDING",
        "CONFIRMED",
        "IN_PROGRESS",
        "DELIVERED",
      ],
      UserStatus: ["ACTIVE", "PENDING", "DELETED"],
      UserType: [
        "VENDOR",
        "CLIENT",
        "DRIVER",
        "ADMIN",
        "HELPDESK",
        "SUPER_ADMIN",
      ],
      VehicleType: ["CAR", "VAN", "TRUCK"],
    },
  },
} as const