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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
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
          id?: string
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
        Relationships: []
      }
      address_favorites: {
        Row: {
          address_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          address_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          address_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "address_favorites_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      address_usage_history: {
        Row: {
          address_id: string
          context: string | null
          id: string
          used_at: string
          user_id: string
        }
        Insert: {
          address_id: string
          context?: string | null
          id?: string
          used_at?: string
          user_id: string
        }
        Update: {
          address_id?: string
          context?: string | null
          id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "address_usage_history_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
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
          id?: string
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
          updatedAt?: string
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
        Relationships: []
      }
      application_sessions: {
        Row: {
          code_expires_at: string | null
          completed: boolean | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          ip_address: string | null
          job_application_id: string | null
          last_activity_at: string | null
          last_name: string | null
          max_uploads: number | null
          role: string | null
          session_expires_at: string
          session_token: string
          upload_count: number | null
          uploaded_files: string[] | null
          user_agent: string | null
          verification_code: string | null
          verified: boolean | null
        }
        Insert: {
          code_expires_at?: string | null
          completed?: boolean | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          ip_address?: string | null
          job_application_id?: string | null
          last_activity_at?: string | null
          last_name?: string | null
          max_uploads?: number | null
          role?: string | null
          session_expires_at: string
          session_token: string
          upload_count?: number | null
          uploaded_files?: string[] | null
          user_agent?: string | null
          verification_code?: string | null
          verified?: boolean | null
        }
        Update: {
          code_expires_at?: string | null
          completed?: boolean | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          ip_address?: string | null
          job_application_id?: string | null
          last_activity_at?: string | null
          last_name?: string | null
          max_uploads?: number | null
          role?: string | null
          session_expires_at?: string
          session_token?: string
          upload_count?: number | null
          uploaded_files?: string[] | null
          user_agent?: string | null
          verification_code?: string | null
          verified?: boolean | null
        }
        Relationships: []
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
          id: string
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
        Relationships: []
      }
      calculator_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          name: string
          updated_at: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
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
          deliveryCost: number | null
          deliveryDistance: number | null
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
          deliveryCost?: number | null
          deliveryDistance?: number | null
          driverStatus?: Database["public"]["Enums"]["DriverStatus"] | null
          guid?: string | null
          headcount?: number | null
          hoursNeeded?: number | null
          id?: string
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
          updatedAt?: string
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
          deliveryCost?: number | null
          deliveryDistance?: number | null
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
        Relationships: []
      }
      client_configurations: {
        Row: {
          area_rules: Json
          client_id: string | null
          client_name: string
          created_at: string
          id: string
          is_active: boolean
          rule_overrides: Json
          template_id: string
          updated_at: string
        }
        Insert: {
          area_rules?: Json
          client_id?: string | null
          client_name: string
          created_at?: string
          id: string
          is_active?: boolean
          rule_overrides?: Json
          template_id: string
          updated_at: string
        }
        Update: {
          area_rules?: Json
          client_id?: string | null
          client_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          rule_overrides?: Json
          template_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_configurations: {
        Row: {
          bridge_toll_settings: Json
          client_name: string
          config_id: string
          created_at: string
          created_by: string | null
          custom_settings: Json | null
          daily_drive_discounts: Json
          description: string | null
          distance_threshold: number
          driver_pay_settings: Json
          id: string
          is_active: boolean
          mileage_rate: number
          notes: string | null
          pricing_tiers: Json
          updated_at: string
          vendor_name: string
        }
        Insert: {
          bridge_toll_settings: Json
          client_name: string
          config_id: string
          created_at?: string
          created_by?: string | null
          custom_settings?: Json | null
          daily_drive_discounts: Json
          description?: string | null
          distance_threshold: number
          driver_pay_settings: Json
          id?: string
          is_active?: boolean
          mileage_rate: number
          notes?: string | null
          pricing_tiers: Json
          updated_at?: string
          vendor_name: string
        }
        Update: {
          bridge_toll_settings?: Json
          client_name?: string
          config_id?: string
          created_at?: string
          created_by?: string | null
          custom_settings?: Json | null
          daily_drive_discounts?: Json
          description?: string | null
          distance_threshold?: number
          driver_pay_settings?: Json
          id?: string
          is_active?: boolean
          mileage_rate?: number
          notes?: string | null
          pricing_tiers?: Json
          updated_at?: string
          vendor_name?: string
        }
        Relationships: []
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
          id?: string
          onDemandId?: string | null
          updatedAt?: string
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
        Relationships: []
      }
      file_uploads: {
        Row: {
          category: string | null
          cateringRequestId: string | null
          fileName: string
          filePath: string | null
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
          filePath?: string | null
          fileSize: number
          fileType: string
          fileUrl: string
          id?: string
          isTemporary?: boolean
          jobApplicationId?: string | null
          onDemandId?: string | null
          updatedAt?: string
          uploadedAt?: string
          userId?: string | null
        }
        Update: {
          category?: string | null
          cateringRequestId?: string | null
          fileName?: string
          filePath?: string | null
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
        Relationships: []
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
          id?: string
          phone: string
          pickupAddress: Json
          specifications: string
          updatedAt?: string
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
          id?: string
          insuranceFilePath?: string | null
          lastName: string
          phone?: string | null
          position: string
          profileId?: string | null
          resumeFilePath?: string | null
          skills?: string | null
          status?: Database["public"]["Enums"]["ApplicationStatus"]
          updatedAt?: string
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
        Relationships: []
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
          id?: string
          industry: string
          lastName: string
          newsletterConsent?: boolean
          updatedAt?: string
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
          id?: string
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
          updatedAt?: string
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
        Relationships: []
      }
      pricing_rules: {
        Row: {
          applies_when: string | null
          base_amount: number | null
          created_at: string
          id: string
          per_unit_amount: number | null
          priority: number
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
          id: string
          per_unit_amount?: number | null
          priority?: number
          rule_name: string
          rule_type: string
          template_id: string
          threshold_type?: string | null
          threshold_value?: number | null
          updated_at: string
        }
        Update: {
          applies_when?: string | null
          base_amount?: number | null
          created_at?: string
          id?: string
          per_unit_amount?: number | null
          priority?: number
          rule_name?: string
          rule_type?: string
          template_id?: string
          threshold_type?: string | null
          threshold_value?: number | null
          updated_at?: string
        }
        Relationships: []
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
          id?: string
          isActive?: boolean
          maxFoodCost?: number | null
          maxHeadCount?: number | null
          minFoodCost: number
          minHeadCount: number
          percentageWithoutTip?: number | null
          percentageWithTip?: number | null
          priceWithoutTip?: number | null
          priceWithTip?: number | null
          updatedAt?: string
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
            foreignKeyName: "profiles_deletedby_fkey"
            columns: ["deletedBy"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quarantine_logs: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          id: string
          quarantine_path: string
          quarantined_at: string
          reason: string
          review_notes: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scan_results: Json | null
          threat_level: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          id?: string
          quarantine_path: string
          quarantined_at?: string
          reason: string
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scan_results?: Json | null
          threat_level: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          quarantine_path?: string
          quarantined_at?: string
          reason?: string
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scan_results?: Json | null
          threat_level?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
          id?: string
          sessionToken: string
          userId: string
        }
        Update: {
          expires?: string
          id?: string
          sessionToken?: string
          userId?: string
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          category: Database["public"]["Enums"]["TestimonialCategory"]
          content: string
          created_at: string
          id: string
          image: string | null
          is_active: boolean
          name: string
          rating: number
          role: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["TestimonialCategory"]
          content: string
          created_at?: string
          id: string
          image?: string | null
          is_active?: boolean
          name: string
          rating?: number
          role?: string | null
          sort_order?: number
          updated_at: string
        }
        Update: {
          category?: Database["public"]["Enums"]["TestimonialCategory"]
          content?: string
          created_at?: string
          id?: string
          image?: string | null
          is_active?: boolean
          name?: string
          rating?: number
          role?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      upload_errors: {
        Row: {
          correlationId: string
          details: string | null
          errorType: string
          id: string
          message: string
          resolved: boolean
          retryable: boolean
          timestamp: string
          userId: string | null
          userMessage: string
        }
        Insert: {
          correlationId: string
          details?: string | null
          errorType: string
          id?: string
          message: string
          resolved?: boolean
          retryable?: boolean
          timestamp?: string
          userId?: string | null
          userMessage: string
        }
        Update: {
          correlationId?: string
          details?: string | null
          errorType?: string
          id?: string
          message?: string
          resolved?: boolean
          retryable?: boolean
          timestamp?: string
          userId?: string | null
          userMessage?: string
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
          id?: string
          isDefault?: boolean
          updatedAt?: string
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
        Relationships: []
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
          id?: string
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
            foreignKeyName: "user_audits_performedby_fkey"
            columns: ["performedBy"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_audits_userid_fkey"
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
          id?: string
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
      webhook_logs: {
        Row: {
          carrier_id: string
          created_at: string
          error_message: string | null
          id: string
          order_number: string
          response_time: number | null
          status: string
          success: boolean
        }
        Insert: {
          carrier_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          order_number: string
          response_time?: number | null
          status: string
          success: boolean
        }
        Update: {
          carrier_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          order_number?: string
          response_time?: number | null
          status?: string
          success?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      upload_error_stats: {
        Row: {
          affected_users: number | null
          avg_hours_to_resolve: number | null
          errorType: string | null
          first_occurrence: string | null
          last_occurrence: string | null
          retryable_count: number | null
          total_count: number | null
          unresolved_count: number | null
        }
        Relationships: []
      }
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
      TestimonialCategory: "CLIENTS" | "VENDORS" | "DRIVERS"
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

type PublicSchema = Database[keyof Omit<Database, "__InternalSupabase">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any; Views: any }
        ? Database[PublicTableNameOrOptions["schema"]]["Tables"] & Database[PublicTableNameOrOptions["schema"]]["Views"]
        : never)
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any; Views: any }
      ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] & Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
          Row: infer R
        }
        ? R
        : never
      : never)
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
        ? Database[PublicTableNameOrOptions["schema"]]["Tables"]
        : never)
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
      ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
          Insert: infer I
        }
        ? I
        : never
      : never)
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
        ? Database[PublicTableNameOrOptions["schema"]]["Tables"]
        : never)
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
      ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
          Update: infer U
        }
        ? U
        : never
      : never)
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicEnumNameOrOptions["schema"]] extends { Enums: any }
        ? Database[PublicEnumNameOrOptions["schema"]]["Enums"]
        : never)
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicEnumNameOrOptions["schema"]] extends { Enums: any }
      ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
      : never)
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
