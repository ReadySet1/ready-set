"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { motion } from "framer-motion";
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
import toast from "react-hot-toast";
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

  useEffect(() => {
    const fetchProfile = async () => {
      if (userLoading) return;

      if (!user) {
        router.push("/sign-in");
        return;
      }

      try {
        setLoading(true);
        const response = await fetch("/api/profile");

        if (!response.ok) {
          throw new Error("Failed to fetch profile data");
        }

        const userData = await response.json();
        setProfile(userData);
      } catch (err) {
        console.error("Profile fetch error:", err);
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, userLoading, router]);

  // Loading states
  if (userLoading || loading) {
    return <ProfileSkeleton />;
  }

  // Error states
  if (userError || error) {
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

              {/* Quick Actions */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-6">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
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

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Profile Content */}
            <div className="col-span-2 space-y-6">
              {/* Personal Information */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                      <div className="flex items-center gap-2 text-slate-900">
                        <User className="h-4 w-4 text-slate-400" />
                        {profile.name || "Not provided"}
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm font-medium text-slate-700">
                        Email Address
                      </Label>
                      <div className="flex items-center gap-2 text-slate-900">
                        <Mail className="h-4 w-4 text-slate-400" />
                        {profile.email || user?.email}
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm font-medium text-slate-700">
                        Phone Number
                      </Label>
                      <div className="flex items-center gap-2 text-slate-900">
                        <Phone className="h-4 w-4 text-slate-400" />
                        Not provided
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm font-medium text-slate-700">
                        Company Name
                      </Label>
                      <div className="flex items-center gap-2 text-slate-900">
                        <Building className="h-4 w-4 text-slate-400" />
                        Not provided
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                      <div className="text-slate-900">Not provided</div>
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm font-medium text-slate-700">
                        Street Address 2
                      </Label>
                      <div className="text-slate-900">Not provided</div>
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
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
