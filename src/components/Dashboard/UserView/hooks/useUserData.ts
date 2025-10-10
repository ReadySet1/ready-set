// src/components/Dashboard/UserView/hooks/useUserData.ts

import { useState, useCallback } from "react";
import { FileWithPath } from "react-dropzone"; // Keep this import for typing
import toast from "react-hot-toast";
import { useUser } from "@/contexts/UserContext";
import { useUploadFile } from "@/hooks/use-upload-file"; // Keep this import
import { User, UserFormValues } from "../types";
import { UseFormSetValue } from "react-hook-form"; // Import UseFormSetValue

// Helper function to get the correct display name based on user type
const getDisplayNameByUserType = (
  userType: string | null | undefined,
  name: string | null | undefined,
  contactName: string | null | undefined
): string => {
  const type = userType?.toLowerCase();
  
  // For drivers, admin, helpdesk, super_admin use 'name' field
  if (type === "driver" || type === "admin" || type === "helpdesk" || type === "super_admin") {
    return name || "";
  }
  
  // For vendors and clients use 'contactName' field
  if (type === "vendor" || type === "client") {
    return contactName || "";
  }
  
  // Fallback: try contactName first, then name
  return contactName || name || "";
};

export const useUserData = (
  userId: string,
  refreshTrigger: number,
  setRefreshTrigger: React.Dispatch<React.SetStateAction<number>>
) => {
  // State management
  const [loading, setLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  // Auth context
  const { session } = useUser();

  // Fetch user data
  const fetchUser = useCallback(async () => {
    if (!userId) return null;

    try {
      setLoading(true);
      
      // Check for admin mode
      const isAdminMode = typeof window !== 'undefined' && localStorage.getItem('admin_mode') === 'true';
      
      // Add a timestamp and request id to prevent caching
      const cacheKey =
        Date.now().toString() + Math.random().toString(36).substring(7);
      const response = await fetch(`/api/users/${userId}?t=${cacheKey}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          "x-request-source": isAdminMode ? "AdminPanel" : "ModernUserProfile",
          "x-admin-mode": isAdminMode ? "true" : "false"
        },
        credentials: 'include'
      });

      if (!response.ok) {
        // Check if we got redirected to sign-in page
        if (response.redirected && response.url.includes('sign-in')) {
          if (isAdminMode) {
                        // Try to reload the page while preserving admin mode
            window.location.reload();
            return null;
          }
          throw new Error("Authentication required - please sign in");
        }
        
        // Try to get the error message from the response body
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch user");
        } catch (jsonError) {
          throw new Error(`Failed to fetch user: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
            
      // Transform the API data to match form structure
      const formData: UserFormValues = {
        id: data.id,
        displayName: getDisplayNameByUserType(data.type, data.name, data.contactName),
        email: data.email,
        contact_number: data.contactNumber,
        type: (data.type?.toLowerCase() as UserFormValues['type']) || "client",
        company_name: data.companyName,
        website: data.website,
        street1: data.street1 || "",
        street2: data.street2 || "",
        city: data.city || "",
        state: data.state || "",
        zip: data.zip || "",
        location_number: data.locationNumber || "",
        parking_loading: data.parkingLoading || "",
        
        // Counties - Use the array provided by the API (already split)
        countiesServed: Array.isArray(data.countiesServed) ? data.countiesServed : [],
        // Keep original string if needed elsewhere, ensure it's a string or fallback
        counties: typeof data.counties === 'string' ? data.counties : "", 
        
        // Time Needed - Use the array directly from the API
        timeNeeded: Array.isArray(data.timeNeeded) ? data.timeNeeded : [],
        
        // Catering Brokerage - Use the array directly from the API
        cateringBrokerage: Array.isArray(data.cateringBrokerage) ? data.cateringBrokerage : [],
        
        // Provisions - Use the array directly from the API
        provisions: Array.isArray(data.provisions) ? data.provisions : [],
        frequency: data.frequency || null,
        headCount: data.headCount ?? null,
        status: data.status || "pending",
        name: data.name,
        contact_name: data.contactName,
        sideNotes: data.sideNotes
      };
      
            
      return formData;
    } catch (error) {
      console.error("Error fetching user:", error);
      toast.error("Failed to fetch user data");
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const handleUploadSuccess = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
    toast.success("File uploaded successfully");
  }, [setRefreshTrigger]);

  const handleStatusChange = async (
    newStatus: NonNullable<UserFormValues["status"]>
  ) => {
    if (isUpdatingStatus || !newStatus) return;

    setIsUpdatingStatus(true);

    try {
      const response = await fetch("/api/users/updateUserStatus", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          newStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update user status");
      }

      toast.success(data.message || "User status updated successfully");
      
      // Update user data immediately
      await fetchUser();
      
      // Trigger full refetch via parent component (keeps data consistent)
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to update user status:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update user status"
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleRoleChange = async (newRoleValue: string) => {
    // Ensure newRoleValue is a valid role type before proceeding
    const newRole = newRoleValue as UserFormValues["type"];
    if (!newRole) {
      toast.error("Invalid role selected.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`/api/users/${userId}/change-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newRole }),
      });

      if (!response.ok) {
        let errorMsg = "Failed to update user role";
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorData.error || errorMsg;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      await response.json();
      await fetchUser(); // Make sure to await this
      toast.success("User role updated successfully!");
    } catch (error) {
      console.error("Failed to update user role:", error);
      toast.error(
        `Failed to update role: ${error instanceof Error ? error.message : "Please try again."}`
      );
    } finally {
      setLoading(false);
    }
  };

  // File upload hooks configuration
  const useUploadFileHook = (category: string) => {
    const uploadHook = useUploadFile({
      defaultUploadedFiles: [],
      userId: userId,
      maxFileCount: 1,
      maxFileSize: 3 * 1024 * 1024,
      allowedFileTypes: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/pdf",
      ],
      category: category,
      entityType: "user",
      entityId: userId,
    });

    const onUpload = async (files: FileWithPath[]): Promise<void> => {
      try {
        await uploadHook.onUpload(files);
        handleUploadSuccess();
      } catch (error) {
        console.error("Upload failed:", error);
        toast.error("File upload failed. Please try again.");
      }
    };

    return {
      onUpload,
      progresses: uploadHook.progresses,
      isUploading: uploadHook.isUploading,
      uploadedFiles: uploadHook.uploadedFiles,
      category,
      entityType: "user",
      entityId: userId,
    };
  };

  return {
    loading,
    isUpdatingStatus,
    fetchUser,
    handleStatusChange,
    handleRoleChange,
    handleUploadSuccess,
    useUploadFileHook
  };
};