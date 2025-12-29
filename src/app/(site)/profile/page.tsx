"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/contexts/UserContext";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  Settings,
  Upload,
  Download,
  Trash2,
  Bell,
  Lock,
  Wrench,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/utils/supabase/client";
import { useUploadFile } from "@/hooks/use-upload-file";
import { FileUploader } from "@/components/Uploader/file-uploader";
import { FileWithPath } from "react-dropzone";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  PasswordChangeModal,
  PasswordChangeSuccessModal,
} from "@/components/Profile";

interface UserProfile {
  id: string;
  name?: string | null;
  email: string | null;
  contact_number?: string | null;
  company_name?: string | null;
  website?: string | null;
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  type?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface UserFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  category?: string;
  uploadedAt: string;
}

// Modern loading skeleton
const ProfileSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
    <div className="container mx-auto px-6 py-8">
      {/* Header Skeleton */}
      <div className="mb-8">
        <Skeleton className="mb-4 h-12 w-80" />
        <Skeleton className="h-6 w-60" />
      </div>

      {/* Main Content Skeleton */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  </div>
);

// User type configuration (keys match database enum values - uppercase)
const userTypeConfig = {
  CLIENT: {
    className:
      "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-800 border border-emerald-200",
    icon: <Building className="mr-1 h-3 w-3" />,
    color: "emerald",
  },
  VENDOR: {
    className:
      "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border border-blue-200",
    icon: <Building className="mr-1 h-3 w-3" />,
    color: "blue",
  },
  DRIVER: {
    className:
      "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-800 border border-amber-200",
    icon: <User className="mr-1 h-3 w-3" />,
    color: "amber",
  },
  ADMIN: {
    className:
      "bg-gradient-to-r from-purple-50 to-purple-100 text-purple-800 border border-purple-200",
    icon: <Shield className="mr-1 h-3 w-3" />,
    color: "purple",
  },
  SUPER_ADMIN: {
    className:
      "bg-gradient-to-r from-rose-50 to-rose-100 text-rose-800 border border-rose-200",
    icon: <Shield className="mr-1 h-3 w-3" />,
    color: "rose",
  },
  HELPDESK: {
    className:
      "bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-800 border border-indigo-200",
    icon: <User className="mr-1 h-3 w-3" />,
    color: "indigo",
  },
};

// Status configuration (keys match database enum values - uppercase)
const statusConfig = {
  ACTIVE: {
    className:
      "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-800 border border-emerald-200",
    color: "emerald",
  },
  PENDING: {
    className:
      "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-800 border border-amber-200",
    color: "amber",
  },
  DELETED: {
    className:
      "bg-gradient-to-r from-red-50 to-red-100 text-red-800 border border-red-200",
    color: "red",
  },
};

const getUserTypeConfig = (type: string) => {
  return (
    userTypeConfig[type as keyof typeof userTypeConfig] || {
      className:
        "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800 border border-gray-200",
      icon: <User className="mr-1 h-3 w-3" />,
      color: "gray",
    }
  );
};

const getStatusConfig = (status: string) => {
  return (
    statusConfig[status as keyof typeof statusConfig] || {
      className:
        "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800 border border-gray-200",
      color: "gray",
    }
  );
};

// Format file size helper
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default function ProfilePage() {
  const router = useRouter();
  const { session, isLoading: isUserLoading, user, updateProfileName } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPasswordSuccessModalOpen, setIsPasswordSuccessModalOpen] = useState(false);

  // Admin settings state (for super_admin users)
  const [adminSettings, setAdminSettings] = useState({
    userType: null as string | null,
    userStatus: null as string | null,
    isTemporaryPassword: false,
  });
  const [isAdminSettingsChanged, setIsAdminSettingsChanged] = useState(false);
  const [isAdminSettingsSaving, setIsAdminSettingsSaving] = useState(false);

  const supabase = createClient();

  // Phone number validation helper
  const validatePhoneNumber = (phone: string | null | undefined): string | null => {
    if (!phone) return null; // Optional field
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      return 'Phone number must be exactly 10 digits';
    }
    return null;
  };

  const {
    status: pushStatus,
    error: pushError,
    isSupported: isPushSupported,
    enableOnThisDevice,
    disableAllDevices,
  } = usePushNotifications();

  // File upload hooks for different categories based on user type
  const driverPhotoUpload = useUploadFile({
    defaultUploadedFiles: [],
    userId: user?.id || "",
    maxFileCount: 1,
    maxFileSize: 3 * 1024 * 1024,
    allowedFileTypes: ["image/jpeg", "image/png", "image/gif"],
    category: "driver_photo",
    entityType: "user",
    entityId: user?.id || "",
  });

  const insurancePhotoUpload = useUploadFile({
    defaultUploadedFiles: [],
    userId: user?.id || "",
    maxFileCount: 1,
    maxFileSize: 3 * 1024 * 1024,
    allowedFileTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
    ],
    category: "insurance_photo",
    entityType: "user",
    entityId: user?.id || "",
  });

  const vehiclePhotoUpload = useUploadFile({
    defaultUploadedFiles: [],
    userId: user?.id || "",
    maxFileCount: 1,
    maxFileSize: 3 * 1024 * 1024,
    allowedFileTypes: ["image/jpeg", "image/png", "image/gif"],
    category: "vehicle_photo",
    entityType: "user",
    entityId: user?.id || "",
  });

  const licensePhotoUpload = useUploadFile({
    defaultUploadedFiles: [],
    userId: user?.id || "",
    maxFileCount: 1,
    maxFileSize: 3 * 1024 * 1024,
    allowedFileTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
    ],
    category: "license_photo",
    entityType: "user",
    entityId: user?.id || "",
  });

  const generalFilesUpload = useUploadFile({
    defaultUploadedFiles: [],
    userId: user?.id || "",
    maxFileCount: 5,
    maxFileSize: 3 * 1024 * 1024,
    allowedFileTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
    ],
    category: "general_files",
    entityType: "user",
    entityId: user?.id || "",
  });

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error("Authentication error:", sessionError?.message);
        toast.error("Authentication error. Please try logging in again.");
        router.push("/sign-in");
        return;
      }

      const response = await fetch(`/api/users/${user.id}`, {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Session expired. Please log in again.");
          router.push("/sign-in");
          return;
        }
        throw new Error("Failed to fetch profile");
      }

      const profileData = await response.json();
      setProfile(profileData);
      setEditedProfile(profileData);

      // Initialize admin settings if user is SUPER_ADMIN
      if (profileData.type === "SUPER_ADMIN") {
        setAdminSettings({
          userType: profileData.type,
          userStatus: profileData.status,
          isTemporaryPassword: profileData.isTemporaryPassword || false,
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, supabase.auth, router]);

  const fetchUserFiles = useCallback(async () => {
    if (!user?.id) return;

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error("Authentication error:", sessionError?.message);
        return;
      }

      const response = await fetch(`/api/users/${user.id}/files`, {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return; // Don't show error for auth issues, just skip
        }
        throw new Error("Failed to fetch files");
      }

      const filesData = await response.json();
      if (Array.isArray(filesData)) {
        setFiles(filesData);
      }
    } catch (error) {
      console.error("Error fetching user files:", error);
      // Don't show toast error for files, as it's not critical
    }
  }, [user?.id, supabase.auth]);

  useEffect(() => {
    if (!isUserLoading && !session) {
      router.push("/sign-in");
    } else if (!isUserLoading && session && user) {
      fetchProfile();
      fetchUserFiles();
    }
  }, [
    session,
    isUserLoading,
    router,
    user,
    refreshTrigger,
    fetchProfile,
    fetchUserFiles,
  ]);

  const handleSave = async () => {
    if (!editedProfile || !user?.id) return;

    // Validate phone number before saving
    if (editedProfile.contact_number) {
      const phoneValidationError = validatePhoneNumber(editedProfile.contact_number);
      if (phoneValidationError) {
        setPhoneError(phoneValidationError);
        toast.error(phoneValidationError);
        return;
      }
    }

    try {
      setIsSaving(true);
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error("Authentication error:", sessionError?.message);
        toast.error("Authentication error. Please try logging in again.");
        router.push("/sign-in");
        return;
      }

      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editedProfile),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Session expired. Please log in again.");
          router.push("/sign-in");
          return;
        }
        throw new Error("Failed to update profile");
      }

      const updatedProfile = await response.json();
      setProfile(updatedProfile);
      setEditedProfile(updatedProfile);
      setIsEditing(false);

      // Update UserContext to reflect name change in sidebar immediately (REA-142)
      if (updatedProfile.name) {
        updateProfileName(updatedProfile.name);
      }

      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  // Handler for saving admin settings (super_admin only)
  const handleSaveAdminSettings = async () => {
    if (!user?.id || !adminSettings.userType || !adminSettings.userStatus) {
      toast.error("User type and status are required");
      return;
    }

    setIsAdminSettingsSaving(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        toast.error("Authentication error. Please try logging in again.");
        router.push("/sign-in");
        return;
      }

      const response = await fetch(`/api/users/${user.id}/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: adminSettings.userType,
          status: adminSettings.userStatus,
          isTemporaryPassword: adminSettings.isTemporaryPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update admin settings");
      }

      toast.success("Admin settings updated successfully");
      setIsAdminSettingsChanged(false);

      // Refresh profile to reflect changes
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error updating admin settings:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update admin settings"
      );
    } finally {
      setIsAdminSettingsSaving(false);
    }
  };

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    if (!editedProfile) return;

    // Validate phone number on change
    if (field === 'contact_number') {
      const error = validatePhoneNumber(value);
      setPhoneError(error);
    }

    setEditedProfile({
      ...editedProfile,
      [field]: value || null,
    });
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error("Authentication error:", sessionError?.message);
        toast.error("Authentication error. Please try logging in again.");
        router.push("/sign-in");
        return;
      }

      const response = await fetch(
        `/api/file-uploads?fileId=${encodeURIComponent(fileId)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete file");
      }

      // Remove the file from the local state
      setFiles((prev) => prev.filter((file) => file.id !== fileId));
      setRefreshTrigger((prev) => prev + 1);
      toast.success("File deleted successfully");
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete file",
      );
    }
  };

  const handleUploadSuccess = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
    fetchUserFiles();
    toast.success("File uploaded successfully!");
  }, [fetchUserFiles]);

  // Group files by category
  const filesByCategory = files.reduce<Record<string, UserFile[]>>(
    (acc, file) => {
      const category = file.category || "General";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(file);
      return acc;
    },
    {},
  );

  if (isUserLoading || isLoading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
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

  const userTypeInfo = getUserTypeConfig(profile.type || "");
  const statusInfo = getStatusConfig(profile.status || "");

  // Define upload fields based on user type
  const getUploadFields = () => {
    if (profile.type === "DRIVER") {
      return [
        {
          name: "driver_photo",
          label: "Driver Photo",
          description:
            "Upload a clear photo of yourself for identification purposes.",
          hook: driverPhotoUpload,
          required: true,
        },
        {
          name: "insurance_photo",
          label: "Insurance Documentation",
          description: "Upload your current vehicle insurance documentation.",
          hook: insurancePhotoUpload,
          required: true,
        },
        {
          name: "vehicle_photo",
          label: "Vehicle Photo",
          description: "Upload a photo of your delivery vehicle.",
          hook: vehiclePhotoUpload,
          required: true,
        },
        {
          name: "license_photo",
          label: "Driver License",
          description: "Upload a photo of your valid driver's license.",
          hook: licensePhotoUpload,
          required: true,
        },
      ];
    } else {
      return [
        {
          name: "general_files",
          label: "Documents",
          description: "Upload and manage your account documents",
          hook: generalFilesUpload,
          required: false,
        },
      ];
    }
  };

  const uploadFields = getUploadFields();

  // Helper functions for user-type aware routing
  // Note: Database uses uppercase types (SUPER_ADMIN, ADMIN, etc.)
  const getDashboardRoute = () => {
    const adminTypes = ["SUPER_ADMIN", "ADMIN", "HELPDESK"];
    return adminTypes.includes(profile?.type || "") ? "/admin" : "/client";
  };

  const getOrdersRoute = () => {
    const adminTypes = ["SUPER_ADMIN", "ADMIN", "HELPDESK"];
    if (adminTypes.includes(profile?.type || "")) {
      return "/admin/catering-orders";
    }
    if (profile?.type === "DRIVER") {
      return "/driver/deliveries";
    }
    return "/client/orders";
  };

  const getOrdersLabel = () => {
    if (profile?.type === "DRIVER") {
      return "My Deliveries";
    }
    return "My Orders";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="container mx-auto px-6 py-8"
      >
        {/* Modern Header */}
        <div className="mb-8">
          {/* Back Navigation */}
          <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="gap-1 px-2 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <span className="text-slate-300">|</span>
            <Link href="/" className="hover:text-slate-700">
              Home
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-slate-700 font-medium">Profile</span>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-4">
                <h1 className="text-3xl font-bold text-slate-800">
                  My Profile
                </h1>
                <Badge
                  className={`${userTypeInfo.className} flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm`}
                >
                  {userTypeInfo.icon}
                  {profile.type?.replace("_", " ") || "User"}
                </Badge>
                <Badge
                  className={`${statusInfo.className} flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm`}
                >
                  {profile.status || "pending"}
                </Badge>
              </div>
              <div className="flex items-center gap-6 text-slate-600">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="font-medium">
                    {profile.name || profile.email}
                  </span>
                </div>
                {profile.created_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Member since{" "}
                      {new Date(profile.created_at).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          year: "numeric",
                        },
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    className="flex items-center gap-2 rounded-xl border-slate-200 px-6 py-2.5 transition-all duration-200 hover:bg-slate-50"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-white shadow-lg transition-all duration-200 hover:bg-emerald-700 hover:shadow-xl"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column - Main Content */}
          <div className="space-y-8 lg:col-span-2">
            {/* Personal Information */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
                  <User className="h-5 w-5 text-blue-600" />
                  Personal Information
                </h2>
              </div>
              <div className="space-y-6 p-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="name"
                      className="text-sm font-medium text-slate-700"
                    >
                      Full Name
                    </Label>
                    {isEditing ? (
                      <Input
                        id="name"
                        value={editedProfile?.name || ""}
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
                        placeholder="Enter your full name"
                        className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="rounded-xl bg-slate-50 p-3 text-slate-800">
                        {profile.name || "Not provided"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-sm font-medium text-slate-700"
                    >
                      Email Address
                    </Label>
                    <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-slate-800">
                      <Mail className="h-4 w-4 text-slate-400" />
                      {profile.email || "Not provided"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="contact_number"
                      className="text-sm font-medium text-slate-700"
                    >
                      Phone Number
                    </Label>
                    {isEditing ? (
                      <>
                        <Input
                          id="contact_number"
                          value={editedProfile?.contact_number || ""}
                          onChange={(e) =>
                            handleInputChange("contact_number", e.target.value)
                          }
                          placeholder="Enter 10-digit phone number"
                          className={`rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 ${
                            phoneError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""
                          }`}
                        />
                        {phoneError && (
                          <p className="text-sm text-red-500">{phoneError}</p>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-slate-800">
                        <Phone className="h-4 w-4 text-slate-400" />
                        {profile.contact_number || "Not provided"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="company_name"
                      className="text-sm font-medium text-slate-700"
                    >
                      Company Name
                    </Label>
                    {isEditing ? (
                      <Input
                        id="company_name"
                        value={editedProfile?.company_name || ""}
                        onChange={(e) =>
                          handleInputChange("company_name", e.target.value)
                        }
                        placeholder="Enter your company name"
                        className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-slate-800">
                        <Building className="h-4 w-4 text-slate-400" />
                        {profile.company_name || "Not provided"}
                      </div>
                    )}
                  </div>
                </div>

                {(profile.type === "VENDOR" || profile.type === "CLIENT") && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="website"
                      className="text-sm font-medium text-slate-700"
                    >
                      Website
                    </Label>
                    {isEditing ? (
                      <Input
                        id="website"
                        value={editedProfile?.website || ""}
                        onChange={(e) =>
                          handleInputChange("website", e.target.value)
                        }
                        placeholder="Enter your website URL"
                        className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-slate-800">
                        <Globe className="h-4 w-4 text-slate-400" />
                        {profile.website ? (
                          <a
                            href={profile.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 transition-colors hover:text-blue-700"
                          >
                            {profile.website}
                          </a>
                        ) : (
                          "Not provided"
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Address Information */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
                  <MapPin className="h-5 w-5 text-green-600" />
                  Address Information
                </h2>
              </div>
              <div className="space-y-6 p-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label
                      htmlFor="street1"
                      className="text-sm font-medium text-slate-700"
                    >
                      Street Address
                    </Label>
                    {isEditing ? (
                      <Input
                        id="street1"
                        value={editedProfile?.street1 || ""}
                        onChange={(e) =>
                          handleInputChange("street1", e.target.value)
                        }
                        placeholder="Enter street address"
                        className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="rounded-xl bg-slate-50 p-3 text-slate-800">
                        {profile.street1 || "Not provided"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label
                      htmlFor="street2"
                      className="text-sm font-medium text-slate-700"
                    >
                      Street Address 2
                    </Label>
                    {isEditing ? (
                      <Input
                        id="street2"
                        value={editedProfile?.street2 || ""}
                        onChange={(e) =>
                          handleInputChange("street2", e.target.value)
                        }
                        placeholder="Apartment, suite, etc. (optional)"
                        className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="rounded-xl bg-slate-50 p-3 text-slate-800">
                        {profile.street2 || "Not provided"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="city"
                      className="text-sm font-medium text-slate-700"
                    >
                      City
                    </Label>
                    {isEditing ? (
                      <Input
                        id="city"
                        value={editedProfile?.city || ""}
                        onChange={(e) =>
                          handleInputChange("city", e.target.value)
                        }
                        placeholder="Enter city"
                        className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="rounded-xl bg-slate-50 p-3 text-slate-800">
                        {profile.city || "Not provided"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="state"
                      className="text-sm font-medium text-slate-700"
                    >
                      State
                    </Label>
                    {isEditing ? (
                      <Input
                        id="state"
                        value={editedProfile?.state || ""}
                        onChange={(e) =>
                          handleInputChange("state", e.target.value)
                        }
                        placeholder="Enter state"
                        className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="rounded-xl bg-slate-50 p-3 text-slate-800">
                        {profile.state || "Not provided"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="zip"
                      className="text-sm font-medium text-slate-700"
                    >
                      ZIP Code
                    </Label>
                    {isEditing ? (
                      <Input
                        id="zip"
                        value={editedProfile?.zip || ""}
                        onChange={(e) =>
                          handleInputChange("zip", e.target.value)
                        }
                        placeholder="Enter ZIP code"
                        className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="rounded-xl bg-slate-50 p-3 text-slate-800">
                        {profile.zip || "Not provided"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Documents Section */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
                  <FileText className="h-5 w-5 text-purple-600" />
                  Documents & Files
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {profile.type === "DRIVER"
                    ? "Upload required documents for driver verification"
                    : "Upload and manage your account documents"}
                </p>
              </div>
              <div className="space-y-8 p-6">
                {/* Existing Files Display */}
                {files.length > 0 && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-slate-800">
                      Uploaded Documents
                    </h3>
                    {Object.entries(filesByCategory).map(
                      ([category, categoryFiles]) => (
                        <div key={category} className="space-y-3">
                          <h4 className="text-sm font-medium capitalize text-slate-600">
                            {category.replace(/_/g, " ")}
                          </h4>
                          <div className="space-y-2">
                            {categoryFiles.map((file) => (
                              <div
                                key={file.id}
                                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4"
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  <FileText className="h-5 w-5 flex-shrink-0 text-slate-400" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium text-slate-800">
                                      {file.fileName}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                      <span>
                                        {formatFileSize(file.fileSize)}
                                      </span>
                                      <span>•</span>
                                      <span>
                                        {new Date(
                                          file.uploadedAt,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      window.open(file.fileUrl, "_blank")
                                    }
                                    className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteFile(file.id)}
                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}

                {/* File Upload Section */}
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-slate-800">
                    Upload New Documents
                  </h3>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {uploadFields.map((field) => (
                      <div key={field.name} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-slate-700">
                            {field.label}
                          </h4>
                          {field.required && (
                            <Badge variant="outline" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {field.description}
                        </p>
                        <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 transition-colors hover:border-slate-300">
                          <FileUploader
                            onUpload={async (files) => {
                              try {
                                await field.hook.onUpload(
                                  files as FileWithPath[],
                                );
                                handleUploadSuccess();
                              } catch (error) {
                                console.error("Upload error:", error);
                                toast.error("Upload failed. Please try again.");
                              }
                            }}
                            progresses={field.hook.progresses}
                            isUploading={field.hook.isUploading}
                            accept={
                              field.name === "driver_photo" ||
                              field.name === "vehicle_photo"
                                ? { "image/*": [] }
                                : { "image/*": [], "application/pdf": [] }
                            }
                            maxSize={3 * 1024 * 1024}
                            maxFileCount={
                              field.name === "general_files" ? 5 : 1
                            }
                            category={field.name}
                            entityType="user"
                            entityId={user?.id || ""}
                          >
                            <div className="py-4 text-center">
                              <Upload className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                              <p className="text-sm font-medium text-slate-600">
                                Drag and drop or click to browse
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {field.name === "driver_photo" ||
                                field.name === "vehicle_photo"
                                  ? "Images only, max 3MB"
                                  : "Images or PDF, max 3MB"}
                              </p>
                            </div>
                          </FileUploader>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Notification Preferences */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <Bell className="h-5 w-5 text-amber-500" />
                  Notification Preferences
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Control delivery status push notifications on this device.
                </p>
              </div>
              <div className="space-y-4 p-6">
                {!isPushSupported ? (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    Push notifications are not supported in this browser. For the best
                    experience, use a modern browser like Chrome, Edge, Firefox, or Safari
                    on a supported device.
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          Delivery status notifications
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Receive push notifications when your deliveries are assigned,
                          en route, arrived, or completed.
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          Current status:{" "}
                          <span className="font-semibold">
                            {pushStatus === "enabled"
                              ? "Enabled on this account"
                              : pushStatus === "disabled"
                              ? "Disabled"
                              : pushStatus === "requesting_permission"
                              ? "Awaiting browser permission..."
                              : pushStatus === "error"
                              ? "Error"
                              : "Checking..."}
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Button
                          type="button"
                          onClick={enableOnThisDevice}
                          disabled={
                            pushStatus === "requesting_permission" ||
                            pushStatus === "enabled"
                          }
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label="Enable delivery status push notifications on this device"
                        >
                          {pushStatus === "requesting_permission"
                            ? "Enabling..."
                            : pushStatus === "enabled"
                            ? "Enabled"
                            : "Enable on this device"}
                        </Button>
                        <Button
                          type="button"
                          onClick={disableAllDevices}
                          variant="outline"
                          className="rounded-xl border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          aria-label="Disable delivery status push notifications on all devices"
                        >
                          Disable on all devices
                        </Button>
                      </div>
                    </div>
                    {pushError && (
                      <div
                        role="status"
                        className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
                      >
                        {pushError}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <Shield className="h-5 w-5 text-purple-600" />
                  Account Status
                </h2>
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-500">
                    Account Type
                  </div>
                  <Badge
                    className={`${userTypeInfo.className} flex w-fit items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold shadow-sm`}
                  >
                    {userTypeInfo.icon}
                    {profile.type?.replace("_", " ") || "User"}
                  </Badge>
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-500">
                    Status
                  </div>
                  <Badge
                    className={`${statusInfo.className} flex w-fit items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold shadow-sm`}
                  >
                    {profile.status || "pending"}
                  </Badge>
                </div>
                {profile.type === "DRIVER" && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-700">
                      <strong>Driver Requirements:</strong> Please upload all
                      required documents to activate your account.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Admin Settings - Super Admin Only */}
            {profile.type === "SUPER_ADMIN" && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-6">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                    <Wrench className="h-5 w-5 text-rose-600" />
                    Admin Settings
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Manage your administrative privileges
                  </p>
                </div>
                <div className="space-y-4 p-6">
                  {/* User Role Select */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">
                      User Role
                    </Label>
                    <Select
                      value={adminSettings.userType || undefined}
                      onValueChange={(value) => {
                        setAdminSettings((prev) => ({
                          ...prev,
                          userType: value,
                        }));
                        setIsAdminSettingsChanged(true);
                      }}
                    >
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Select user role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="HELPDESK">Helpdesk</SelectItem>
                        <SelectItem value="CLIENT">Client</SelectItem>
                        <SelectItem value="VENDOR">Vendor</SelectItem>
                        <SelectItem value="DRIVER">Driver</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Account Status Select */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">
                      Account Status
                    </Label>
                    <Select
                      value={adminSettings.userStatus || undefined}
                      onValueChange={(value) => {
                        setAdminSettings((prev) => ({
                          ...prev,
                          userStatus: value,
                        }));
                        setIsAdminSettingsChanged(true);
                      }}
                    >
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="DELETED">Deleted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Require Password Reset Toggle */}
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">
                        Require Password Reset
                      </Label>
                      <p className="text-xs text-slate-500">
                        Prompt for new password on next login
                      </p>
                    </div>
                    <Switch
                      checked={adminSettings.isTemporaryPassword}
                      onCheckedChange={(checked) => {
                        setAdminSettings((prev) => ({
                          ...prev,
                          isTemporaryPassword: checked,
                        }));
                        setIsAdminSettingsChanged(true);
                      }}
                    />
                  </div>

                  {/* Save Button */}
                  <Button
                    className="w-full rounded-xl"
                    disabled={!isAdminSettingsChanged || isAdminSettingsSaving}
                    onClick={handleSaveAdminSettings}
                  >
                    {isAdminSettingsSaving
                      ? "Saving..."
                      : "Save Admin Settings"}
                  </Button>
                </div>
              </div>
            )}

            {/* Account Timeline */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <Clock className="h-5 w-5 text-amber-600" />
                  Account Timeline
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {profile.created_at && (
                    <div className="flex items-start gap-3">
                      <div className="mt-2 h-2 w-2 rounded-full bg-blue-500"></div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">
                          Account Created
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(profile.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                  {profile.updated_at && (
                    <div className="flex items-start gap-3">
                      <div className="mt-2 h-2 w-2 rounded-full bg-green-500"></div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">
                          Last Updated
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(profile.updated_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                  {files.length > 0 && (
                    <div className="flex items-start gap-3">
                      <div className="mt-2 h-2 w-2 rounded-full bg-purple-500"></div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">
                          Documents Uploaded
                        </div>
                        <div className="text-xs text-slate-500">
                          {files.length} file{files.length !== 1 ? "s" : ""}{" "}
                          uploaded
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <Settings className="h-5 w-5 text-indigo-600" />
                  Quick Actions
                </h2>
              </div>
              <div className="space-y-3 p-6">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 rounded-xl hover:bg-slate-50"
                  onClick={() => router.push(getDashboardRoute())}
                >
                  <FileText className="h-4 w-4" />
                  View Dashboard
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 rounded-xl hover:bg-slate-50"
                  onClick={() => router.push(getOrdersRoute())}
                >
                  <FileText className="h-4 w-4" />
                  {getOrdersLabel()}
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 rounded-xl hover:bg-slate-50"
                  onClick={() => setIsPasswordModalOpen(true)}
                >
                  <Lock className="h-4 w-4" />
                  Change Password
                </Button>
                {/* Account Settings button removed per Phase 2 */}
              </div>
            </div>
          </div>
        </div>

        {/* Password Change Modals */}
        <PasswordChangeModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          userEmail={profile?.email || ""}
          onSuccess={() => {
            setIsPasswordModalOpen(false);
            setIsPasswordSuccessModalOpen(true);
          }}
        />
        <PasswordChangeSuccessModal
          isOpen={isPasswordSuccessModalOpen}
          onClose={() => setIsPasswordSuccessModalOpen(false)}
          userEmail={profile?.email || ""}
        />
      </motion.div>
    </div>
  );
}
