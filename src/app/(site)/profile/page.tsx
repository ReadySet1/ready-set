"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { motion } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Globe,
  Edit3,
  Save,
  X,
  Shield,
  Calendar,
  Clock,
  FileText,
  Upload,
  Download,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useUploadFile } from "@/hooks/use-upload-file";
import { FileUploader } from "@/components/Uploader/file-uploader";
import { FileWithPath } from "react-dropzone";
import { Loading } from "@/components/ui/loading";
import ErrorBoundary from "@/components/ErrorBoundary/ErrorBoundary";

// Profile Loading Skeleton
const ProfileSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="col-span-2 space-y-6">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    </div>
  </div>
);

// Profile Error Boundary Fallback
const ProfileErrorFallback = ({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) => (
  <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <Shield className="h-6 w-6 text-red-600" />
      </div>
      <h3 className="mb-2 text-center text-xl font-semibold text-slate-900">
        Profile Loading Error
      </h3>
      <p className="mb-6 text-center text-sm text-red-600">
        {error.message ||
          "An unexpected error occurred while loading your profile."}
      </p>
      <div className="flex justify-center space-x-4">
        <Button
          onClick={resetErrorBoundary}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/")}
          className="border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          Go Home
        </Button>
      </div>
    </motion.div>
  </div>
);

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    isLoading: userLoading,
    error: userError,
    refreshUserData,
  } = useUser();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Enhanced authentication check with timeout
  useEffect(() => {
    const checkAuthentication = async () => {
      console.log("[ProfilePage] Starting authentication check", {
        userLoading,
        hasUser: !!user,
        userError,
        authCheckComplete,
      });

      // Wait for UserContext to finish loading
      if (userLoading) {
        console.log("[ProfilePage] UserContext still loading, waiting...");
        return;
      }

      // If we have a user, authentication is successful
      if (user) {
        console.log(
          "[ProfilePage] User authenticated, proceeding to fetch profile",
        );
        setAuthCheckComplete(true);
        return;
      }

      // If no user and context is loaded, check if we should redirect
      if (!user && !userLoading && !userError) {
        console.log(
          "[ProfilePage] No user found, checking if redirect is needed",
        );

        // Add a safety delay to ensure all async operations are complete
        const redirectTimeout = setTimeout(() => {
          console.log(
            "[ProfilePage] Redirect timeout reached, checking auth state again",
          );

          // Double-check authentication state before redirecting
          if (!user && !userLoading) {
            console.log(
              "[ProfilePage] Confirmed no user, redirecting to sign-in",
            );
            router.push("/sign-in");
          }
        }, 500); // Increased timeout for better reliability

        return () => clearTimeout(redirectTimeout);
      }

      // If there's an error, mark check as complete
      if (userError) {
        console.log("[ProfilePage] UserContext error detected:", userError);
        setAuthCheckComplete(true);
      }
    };

    checkAuthentication();
  }, [user, userLoading, userError, router]);

  // Fetch profile data when authentication is confirmed
  useEffect(() => {
    const fetchProfile = async () => {
      // Only proceed if authentication check is complete and we have a user
      if (!authCheckComplete || !user) {
        return;
      }

      console.log("[ProfilePage] Fetching profile data for user:", user.id);

      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/profile", {
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });

        console.log(
          "[ProfilePage] Profile API response status:",
          response.status,
        );

        if (!response.ok) {
          if (response.status === 401) {
            console.log("[ProfilePage] 401 Unauthorized from API");
            setError("You are not authorized to view this profile.");
            setProfile(null);
            return;
          }
          throw new Error(`Failed to fetch profile data: ${response.status}`);
        }

        const userData = await response.json();
        console.log("[ProfilePage] Profile data received:", userData);
        setProfile(userData);
      } catch (err) {
        console.error("[ProfilePage] Profile fetch error:", err);
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, authCheckComplete]);

  // Initialize edit data when profile is loaded
  useEffect(() => {
    if (profile && !isEditing) {
      setEditData({
        name: profile.name || "",
        contactNumber: profile.contactNumber || "",
        companyName: profile.companyName || "",
        street1: profile.street1 || "",
        street2: profile.street2 || "",
        city: profile.city || "",
        state: profile.state || "",
        zip: profile.zip || "",
      });
    }
  }, [profile, isEditing]);

  // Handle edit mode toggle
  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing - reset form data
      setEditData({
        name: profile.name || "",
        contactNumber: profile.contactNumber || "",
        companyName: profile.companyName || "",
        street1: profile.street1 || "",
        street2: profile.street2 || "",
        city: profile.city || "",
        state: profile.state || "",
        zip: profile.zip || "",
      });
      setSaveError(null);
    }
    setIsEditing(!isEditing);
  };

  // Handle input changes
  const handleInputChange = (field: string, value: string) => {
    setEditData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
    setSaveError(null); // Clear any previous errors
  };

  // Handle save
  const handleSave = async () => {
    if (!user) return;

    // Basic validation - check if name is empty
    if (!editData.name?.trim()) {
      setSaveError("Full name is required");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
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

  // Enhanced loading states with better coordination
  if (userLoading || !authCheckComplete) {
    console.log("[ProfilePage] Showing loading skeleton", {
      userLoading,
      authCheckComplete,
    });
    return <ProfileSkeleton />;
  }

  // Error states
  if (userError || error) {
    console.log("[ProfilePage] Showing error state", { userError, error });
    const errorObject = new Error(
      userError || error || "Unable to load profile information",
    );

    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="mb-2 text-center text-xl font-semibold text-slate-900">
            Profile Error
          </h3>
          <p className="mb-6 text-center text-sm text-red-600">
            {errorObject.message}
          </p>
          <div className="flex justify-center space-x-4">
            <Button
              onClick={refreshUserData}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Go Home
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // No profile found
  if (!profile) {
    console.log("[ProfilePage] No profile found, showing not found state");
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mx-4 max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl"
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <User className="h-8 w-8 text-slate-400" />
          </div>
          <h2 className="mb-3 text-2xl font-bold text-slate-800">
            Profile Not Found
          </h2>
          <p className="mb-6 text-slate-500">
            We couldn't load your profile information.
          </p>
          <Button
            variant="default"
            onClick={() => router.push("/client")}
            className="rounded-xl bg-blue-600 px-6 py-2 text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl"
          >
            Go to Dashboard
          </Button>
        </motion.div>
      </div>
    );
  }

  console.log("[ProfilePage] Rendering profile page with data:", profile);

  return (
    <ErrorBoundary
      fallback={
        <ProfileErrorFallback
          error={new Error(error || "An unexpected error occurred")}
          resetErrorBoundary={() => {
            refreshUserData();
          }}
        />
      }
    >
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#363636",
            color: "#fff",
          },
        }}
      />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="container mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-4">
                  <h1 className="text-3xl font-bold text-slate-800">
                    My Profile
                  </h1>
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-blue-700"
                  >
                    <User className="mr-1 h-3 w-3" />
                    {profile.type || "CLIENT"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`${
                      profile.status === "pending"
                        ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                        : "border-green-200 bg-green-50 text-green-700"
                    }`}
                  >
                    {profile.status?.toUpperCase() || "PENDING"}
                  </Badge>
                </div>
                <p className="text-slate-600">{profile.name || user?.email}</p>
              </div>

              {/* Edit Profile Button / Save & Cancel */}
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button
                    className="bg-blue-600 text-white hover:bg-blue-700"
                    onClick={handleEditToggle}
                  >
                    <Edit3 className="mr-2 h-4 w-4" />
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button
                      className="bg-green-600 text-white hover:bg-green-700"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleEditToggle}
                      disabled={saving}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Save Error Display */}
          {saveError && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-red-700">
                <X className="h-4 w-4" />
                <span className="font-medium">Error saving profile:</span>
              </div>
              <p className="mt-1 text-sm text-red-600">{saveError}</p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Profile Content */}
            <div className="col-span-2 space-y-6">
              {/* Personal Information */}
              <div
                className={`overflow-hidden rounded-2xl border ${isEditing ? "border-blue-300 bg-blue-50/30" : "border-slate-200"} bg-white shadow-sm`}
              >
                <div className="border-b border-slate-100 p-6">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                    <User className="h-5 w-5" />
                    Personal Information
                  </h2>
                </div>
                <div className="p-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <Label className="mb-2 block text-sm font-medium text-slate-700">
                        Full Name
                      </Label>
                      {isEditing ? (
                        <Input
                          value={editData.name}
                          onChange={(e) =>
                            handleInputChange("name", e.target.value)
                          }
                          placeholder="Enter full name"
                          className="w-full"
                        />
                      ) : (
                        <div className="flex items-center gap-2 text-slate-900">
                          <User className="h-4 w-4 text-slate-400" />
                          {profile.name || "Not provided"}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm font-medium text-slate-700">
                        Email Address
                      </Label>
                      <div className="flex items-center gap-2 text-slate-900">
                        <Mail className="h-4 w-4 text-slate-400" />
                        {profile.email || user?.email}
                        {isEditing && (
                          <span className="text-xs text-slate-500">
                            (Read only)
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm font-medium text-slate-700">
                        Phone Number
                      </Label>
                      {isEditing ? (
                        <Input
                          value={editData.contactNumber}
                          onChange={(e) =>
                            handleInputChange("contactNumber", e.target.value)
                          }
                          placeholder="Enter phone number"
                          className="w-full"
                        />
                      ) : (
                        <div className="flex items-center gap-2 text-slate-900">
                          <Phone className="h-4 w-4 text-slate-400" />
                          {profile.contactNumber || "Not provided"}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm font-medium text-slate-700">
                        Company Name
                      </Label>
                      {isEditing ? (
                        <Input
                          value={editData.companyName}
                          onChange={(e) =>
                            handleInputChange("companyName", e.target.value)
                          }
                          placeholder="Enter company name"
                          className="w-full"
                        />
                      ) : (
                        <div className="flex items-center gap-2 text-slate-900">
                          <Building className="h-4 w-4 text-slate-400" />
                          {profile.companyName || "Not provided"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div
                className={`overflow-hidden rounded-2xl border ${isEditing ? "border-blue-300 bg-blue-50/30" : "border-slate-200"} bg-white shadow-sm`}
              >
                <div className="border-b border-slate-100 p-6">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                    <MapPin className="h-5 w-5" />
                    Address Information
                  </h2>
                </div>
                <div className="p-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <Label className="mb-2 block text-sm font-medium text-slate-700">
                        Street Address
                      </Label>
                      {isEditing ? (
                        <Input
                          value={editData.street1}
                          onChange={(e) =>
                            handleInputChange("street1", e.target.value)
                          }
                          placeholder="Enter street address"
                          className="w-full"
                        />
                      ) : (
                        <div className="text-slate-900">
                          {profile.street1 || "Not provided"}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm font-medium text-slate-700">
                        Street Address 2
                      </Label>
                      {isEditing ? (
                        <Input
                          value={editData.street2}
                          onChange={(e) =>
                            handleInputChange("street2", e.target.value)
                          }
                          placeholder="Enter street address 2 (optional)"
                          className="w-full"
                        />
                      ) : (
                        <div className="text-slate-900">
                          {profile.street2 || "Not provided"}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm font-medium text-slate-700">
                        City
                      </Label>
                      {isEditing ? (
                        <Input
                          value={editData.city}
                          onChange={(e) =>
                            handleInputChange("city", e.target.value)
                          }
                          placeholder="Enter city"
                          className="w-full"
                        />
                      ) : (
                        <div className="text-slate-900">
                          {profile.city || "Not provided"}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm font-medium text-slate-700">
                        State
                      </Label>
                      {isEditing ? (
                        <Input
                          value={editData.state}
                          onChange={(e) =>
                            handleInputChange("state", e.target.value)
                          }
                          placeholder="Enter state"
                          className="w-full"
                        />
                      ) : (
                        <div className="text-slate-900">
                          {profile.state || "Not provided"}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm font-medium text-slate-700">
                        ZIP Code
                      </Label>
                      {isEditing ? (
                        <Input
                          value={editData.zip}
                          onChange={(e) =>
                            handleInputChange("zip", e.target.value)
                          }
                          placeholder="Enter ZIP code"
                          className="w-full"
                        />
                      ) : (
                        <div className="text-slate-900">
                          {profile.zip || "Not provided"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Account Status */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-6">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                    <Shield className="h-5 w-5" />
                    Account Status
                  </h2>
                </div>
                <div className="space-y-4 p-6">
                  <div>
                    <Label className="mb-2 block text-sm font-medium text-slate-700">
                      Account Type
                    </Label>
                    <Badge
                      variant="outline"
                      className="border-blue-200 bg-blue-50 text-blue-700"
                    >
                      <User className="mr-1 h-3 w-3" />
                      {profile.type || "CLIENT"}
                    </Badge>
                  </div>

                  <div>
                    <Label className="mb-2 block text-sm font-medium text-slate-700">
                      Status
                    </Label>
                    <Badge
                      variant="outline"
                      className={`${
                        profile.status === "pending"
                          ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                          : "border-green-200 bg-green-50 text-green-700"
                      }`}
                    >
                      {profile.status?.toUpperCase() || "PENDING"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Account Timeline */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-6">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                    <Clock className="h-5 w-5" />
                    Account Timeline
                  </h2>
                </div>
                <div className="p-6">
                  <p className="text-sm text-slate-500">
                    Timeline information will be displayed here.
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-6">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                    <FileText className="h-5 w-5" />
                    Quick Actions
                  </h2>
                </div>
                <div className="space-y-3 p-6">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 rounded-xl hover:bg-slate-50"
                    onClick={() => router.push("/client")}
                  >
                    <FileText className="h-4 w-4" />
                    View Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 rounded-xl hover:bg-slate-50"
                    onClick={() => router.push("/order-status")}
                  >
                    <FileText className="h-4 w-4" />
                    My Orders
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
