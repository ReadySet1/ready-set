import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { toast } from "react-hot-toast";
import { onAuthEvent } from "@/utils/auth-events";

export const useProfile = () => {
  const router = useRouter();
  const {
    user,
    isLoading: userLoading,
    error: userError,
    refreshUserData,
    retryAuth,
    clearError,
    authState,
    profileState,
  } = useUser();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileFetchAttempts, setProfileFetchAttempts] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Aggressive fallback: show content as soon as profile data is available
  const [forceShowContent, setForceShowContent] = useState(false);

  useEffect(() => {
    // If profile data is available, force show content after 2 seconds
    if (profile && !forceShowContent) {
      const timeout = setTimeout(() => {
        setForceShowContent(true);
      }, 2000); // 2 seconds
      return () => clearTimeout(timeout);
    }
  }, [profile, forceShowContent]);

  const fetchProfileData = useCallback(async () => {
    if (!user?.id) {
      console.log("[ProfilePage] No user ID, skipping profile fetch");
      return;
    }

    console.log("[ProfilePage] Fetching profile data for user:", user.id);
    setLoading(true);
    setError(null);

    try {
      console.log("[ProfilePage] Making API call to /api/profile");
      const response = await fetch(`/api/profile`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log("[ProfilePage] Response status:", response.status);
      console.log("[ProfilePage] Response headers:", Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[ProfilePage] Response error text:", errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log("[ProfilePage] Profile data fetched successfully:", data);
      setProfile(data);
      setLastFetchTime(new Date());
    } catch (err) {
      console.error("[ProfilePage] Profile fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Auth state change handler - trigger profile fetch when user becomes authenticated
  useEffect(() => {
    console.log("[ProfilePage] Auth state changed:", {
      user: !!user,
      userId: user?.id,
      authStateInitialized: authState.isInitialized,
      isAuthenticated: authState.isAuthenticated,
      hasProfile: !!profile,
      loading,
    });

    // If user just became authenticated and we don't have profile data, fetch it
    if (user?.id && authState.isAuthenticated && !profile && !loading) {
      console.log("[ProfilePage] User authenticated, triggering profile fetch");
      fetchProfileData();
    }
  }, [user, authState.isAuthenticated, profile, loading, fetchProfileData]);

  // Listen for auth events to trigger immediate profile fetch
  useEffect(() => {
    console.log("[ProfilePage] Setting up auth event listener");

    const unsubscribe = onAuthEvent((event) => {
      const { type, payload } = event.detail;
      console.log(`[ProfilePage] Received auth event: ${type}`, { payload });

      if (type === "login" && payload?.user && !profile) {
        console.log("[ProfilePage] Login event received, triggering profile fetch");
        // Small delay to ensure auth state is updated
        setTimeout(() => {
          fetchProfileData();
        }, 200);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [fetchProfileData, profile]);

  // Simplified authentication check
  useEffect(() => {
    console.log("[ProfilePage] Auth state:", {
      userLoading,
      hasUser: !!user,
      userId: user?.id,
      userError: userError?.message,
      authState: {
        isInitialized: authState.isInitialized,
        isAuthenticated: authState.isAuthenticated,
        isLoading: authState.isLoading,
      },
    });

    // If no user and auth is initialized, redirect to login
    if (!user && authState.isInitialized && !userLoading) {
      console.log("[ProfilePage] No user found, redirecting to login");
      router.push("/login");
    }
  }, [user, userLoading, userError, authState.isInitialized, authState.isAuthenticated, authState.isLoading, router]);

  // Profile fetch effect
  useEffect(() => {
    console.log("[ProfilePage] Profile fetch effect triggered:", {
      userId: user?.id,
      hasProfile: !!profile,
      loading,
      userLoading,
      authStateInitialized: authState.isInitialized,
      isAuthenticated: authState.isAuthenticated,
    });
    
    if (user?.id && !profile && !loading) {
      console.log("[ProfilePage] Fetching profile for user:", user.id);
      fetchProfileData();
    } else {
      console.log("[ProfilePage] Not fetching profile because:", {
        hasUserId: !!user?.id,
        hasProfile: !!profile,
        isLoading: loading,
      });
    }
  }, [user?.id, profile, loading, fetchProfileData, userLoading, authState.isInitialized, authState.isAuthenticated]);

  // Enhanced retry function
  const handleRetry = useCallback(async () => {
    console.log("[ProfilePage] Retrying profile fetch");
    setError(null);
    setProfileFetchAttempts((prev) => prev + 1);
    await fetchProfileData();
  }, [fetchProfileData]);

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing
      setIsEditing(false);
      setEditData({});
      setSaveError(null);
    } else {
      // Start editing
      setIsEditing(true);
      setEditData({
        name: profile.name || "",
        phone: profile.phone || "",
        company_name: profile.company_name || "",
        street_address: profile.street_address || "",
        street_address_2: profile.street_address_2 || "",
        city: profile.city || "",
        state: profile.state || "",
        zip_code: profile.zip_code || "",
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setEditData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast.error("User not found");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/profile`, {
        method: "PATCH",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update profile");
      }

      const updatedUser = await response.json();

      // Update local profile state
      setProfile((prev: any) => ({
        ...prev,
        ...editData,
      }));

      // Exit edit mode
      setIsEditing(false);

      // Show success message
      toast.success("Profile updated successfully!");
    } catch (err) {
      console.error("Save error:", err);
      setSaveError(
        err instanceof Error ? err.message : "Failed to save changes",
      );
    } finally {
      setSaving(false);
    }
  };

  return {
    profile,
    loading,
    error,
    isEditing,
    editData,
    saving,
    saveError,
    handleEditToggle,
    handleInputChange,
    handleSave,
    handleRetry,
    user,
    userLoading,
    userError,
    authState,
  };
}; 