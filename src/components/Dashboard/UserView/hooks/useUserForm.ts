import { useEffect } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import toast from "react-hot-toast";
import { UserFormValues } from "../types";
import { createClient } from "@/utils/supabase/client";
import { useUser } from "@/contexts/UserContext";

// Define a type that extends UseFormReturn with our custom properties
type ExtendedUseFormReturn = UseFormReturn<UserFormValues> & {
  watchedValues: UserFormValues;
  hasUnsavedChanges: boolean;
  onSubmit: (data: UserFormValues) => Promise<void>;
};

export const useUserForm = (
  userId: string,
  fetchUser: () => Promise<UserFormValues | null>,
  onSaveSuccess?: () => void
): ExtendedUseFormReturn => {
  // Get user session from context
  const { session } = useUser();
  
  // Create the form with react-hook-form
  const methods = useForm<UserFormValues>({
    defaultValues: {
      id: "",
      displayName: "",
      email: "",
      contact_number: "",
      type: "client",
      street1: "",
      street2: "",
      city: "",
      state: "",
      zip: "",
      company_name: "",
      website: "",
      location_number: "",
      parking_loading: "",
      countiesServed: [],
      counties: [],
      timeNeeded: [],
      cateringBrokerage: [],
      provisions: [],
      frequency: null,
      headCount: null,
      status: "pending",
      name: null,
      contact_name: null,
      sideNotes: null
    },
  });

  // Load initial data
  useEffect(() => {
    const loadUserData = async () => {
            const userData = await fetchUser();
      if (userData) {
                try {
          // Ensure array fields are arrays, not null
          const formattedUserData = {
            ...userData,
            countiesServed: userData.countiesServed || [],
            counties: userData.counties || [],
            timeNeeded: userData.timeNeeded || [],
            cateringBrokerage: userData.cateringBrokerage || [],
            provisions: userData.provisions || [],
          };
          methods.reset(formattedUserData);
                  } catch (error) {
          console.error("[useUserForm] Error during form reset:", error);
        }
      } else {
              }
    };
    
    loadUserData();
  }, [fetchUser, methods]);

  // Form submission
  const onSubmit = async (data: UserFormValues) => {
    try {      
      // Destructure known fields
      const {
        displayName,
        // Form-specific array fields
        counties,          // For clients
        countiesServed,    // For vendors
        timeNeeded,        // For both
        cateringBrokerage, // For vendors
        provisions,        // For vendors
        // Base fields
        type,
        ...baseSubmitData
      } = data;

                        
      // Prepare data for the API, matching Prisma schema fields
      const submitData: any = {
        ...baseSubmitData, // Includes id, email, address fields, headCount, frequency, status, etc.
        type: type,
        
        // Fix: Handle counties field properly - both vendors and clients use 'counties' field in database
        counties: (() => {
          if (type === 'vendor' && countiesServed && Array.isArray(countiesServed)) {
                        return countiesServed.join(",");
          } else if (type === 'client' && counties && Array.isArray(counties)) {
                        return counties.join(",");
          }
                    return null;
        })(),
        
        // timeNeeded field in Prisma is String?
        timeNeeded: timeNeeded && Array.isArray(timeNeeded) ? timeNeeded.join(",") : null,
        
        // cateringBrokerage field in Prisma is String?
        cateringBrokerage: type === 'vendor' && cateringBrokerage && Array.isArray(cateringBrokerage) ? cateringBrokerage.join(",") : null,
        
        // provisions field - API maps this to 'provide' column in Prisma
        provisions: type === 'vendor' && provisions && Array.isArray(provisions) ? provisions.join(",") : null,
        
        // headCount is handled by baseSubmitData as it's number | null
        // frequency is handled by baseSubmitData as it's string | null
      };

      // Set name/contact_name based on the form's 'type' field
      // Since the users list displays 'name' first, we should always update 'name' 
      // to ensure consistency across the UI
      if (
        type === "driver" ||
        type === "helpdesk" ||
        type === "admin" ||
        type === "super_admin"
      ) {
        submitData.name = displayName;
        submitData.contact_name = data.contact_name || null;
      } else if (type === "vendor" || type === "client") {
        // For vendors and clients, update both fields to ensure consistency
        submitData.name = displayName;        // Users list displays this field
        submitData.contact_name = displayName; // Form expects this field
      } else {
        console.warn(`Unexpected user type ${type} in form submission`);
        submitData.name = displayName;
        submitData.contact_name = displayName;
      }
      
            
      // Get the current auth token
      let authToken = session?.access_token;
      
      // If no token in context, try to get it directly from Supabase
      if (!authToken) {
        try {
          const supabase = createClient();
          const { data } = await supabase.auth.getSession();
          authToken = data.session?.access_token;
                  } catch (tokenError) {
          console.error("Failed to get auth token:", tokenError);
        }
      }
      
      // Check if we have the admin mode flag
      const isAdminMode = typeof window !== 'undefined' && localStorage.getItem('admin_mode') === 'true';
      
      const response = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "x-request-source": "ModernUserProfile-Submit",
          "x-admin-mode": isAdminMode ? "true" : "false",
          ...(authToken && { "Authorization": `Bearer ${authToken}` })
        },
        body: JSON.stringify(submitData),
        credentials: 'include'
      });

      if (!response.ok) {
        let errorMsg = "Failed to update user";
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorData.error || errorMsg;
          console.error("API Error:", errorData);
        } catch (_) {
          /* Ignore JSON parsing error */
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();

      // If this was a new user creation (userId === 'new'), redirect to the new user's page
      if (userId === 'new' && result.id) {
        toast.success("User created successfully!");
        // Redirect to the newly created user's page
        setTimeout(() => {
          window.location.href = `/admin/users/${result.id}`;
        }, 500);
        return;
      }

      await fetchUser(); // Refetch to ensure UI is updated
      toast.success("User saved successfully!");

      // Call the success callback if provided (for navigation/refresh)
      if (onSaveSuccess) {
        // Add a small delay to allow the toast to show before navigation
        setTimeout(() => {
          onSaveSuccess();
        }, 1000);
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(
        `Failed to save user: ${error instanceof Error ? error.message : "Please try again."}`
      );
    }
  };

  // Watch form values
  const watchedValues = methods.watch();
  const hasUnsavedChanges = methods.formState.isDirty;
  
  // Return the complete form methods and our custom properties
  return {
    ...methods,
    watchedValues,
    hasUnsavedChanges,
    onSubmit
  };
};