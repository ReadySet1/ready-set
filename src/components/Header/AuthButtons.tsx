import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  User,
  SupabaseClient,
  Session,
  AuthChangeEvent,
} from "@supabase/supabase-js";
import { clearAuthCookies } from "@/utils/auth/cookies";
import { useUser } from "@/contexts/UserContext";
import { UserType } from "@/types/user";

// Map user roles to their display names and paths
const ROLE_DISPLAY_INFO: Record<UserType, { title: string; path: string }> = {
  [UserType.VENDOR]: {
    title: "Vendor Dashboard",
    path: "/client",
  },
  [UserType.CLIENT]: {
    title: "Client Dashboard",
    path: "/client",
  },
  [UserType.DRIVER]: {
    title: "Driver Dashboard",
    path: "/driver",
  },
  [UserType.ADMIN]: {
    title: "Admin Dashboard",
    path: "/admin",
  },
  [UserType.HELPDESK]: {
    title: "Helpdesk Portal",
    path: "/admin",
  },
  [UserType.SUPER_ADMIN]: {
    title: "Super Admin",
    path: "/admin",
  },
};

interface AuthButtonsProps {
  sticky: boolean;
  pathUrl: string;
}

const AuthButtons: React.FC<AuthButtonsProps> = ({ sticky, pathUrl }) => {
  const { user, userRole, isLoading } = useUser();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  // Initialize Supabase client for sign out functionality
  useEffect(() => {
    const initSupabase = async () => {
      try {
        const client = await createClient();
        setSupabase(client);
      } catch (error) {
        console.error("Error initializing Supabase client:", error);
      }
    };

    initSupabase();
  }, []);

  // Add debug logging to track state changes
  useEffect(() => {
      }, [user, userRole, isLoading]);

  // Show minimal loading state - skeleton loader
  if (isLoading) {
    return (
      <div className="flex items-center gap-4">
        <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"></div>
        <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"></div>
      </div>
    );
  }

  // If we have a user, we should have a role
  // This defensive check ensures we don't show wrong buttons during state transitions
  if (user && userRole) {
    const roleInfo = ROLE_DISPLAY_INFO[userRole];
    return (
      <>
        <Link href={roleInfo.path}>
          <p
            className={`loginBtn px-7 py-3 text-base font-medium ${
              !sticky && pathUrl === "/" ? "text-white" : "text-black"
            }`}
          >
            {roleInfo.title}
          </p>
        </Link>
        <SignOutButton sticky={sticky} pathUrl={pathUrl} />
      </>
    );
  }

  // Only show sign in/up buttons if we're definitely not authenticated
  // and not in a loading state
  if (!isLoading && !user) {
    return (
      <>
        <SignInButton sticky={sticky} pathUrl={pathUrl} />
        <SignUpButton sticky={sticky} pathUrl={pathUrl} />
      </>
    );
  }

  // Fallback - should rarely be reached
  return null;
};

interface ButtonProps {
  sticky: boolean;
  pathUrl: string;
}

const SignOutButton: React.FC<ButtonProps> = ({ sticky, pathUrl }) => {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  // Initialize Supabase client
  useEffect(() => {
    const initSupabase = async () => {
      try {
        const client = await createClient();
        setSupabase(client);
      } catch (error) {
        console.error("Error initializing Supabase client:", error);
      }
    };

    initSupabase();
  }, []);

  const handleSignOut = async () => {
    if (!supabase) {
      console.error("Supabase client not initialized");
      return;
    }

    try {
      // Clear all authentication cookies before signing out
      clearAuthCookies();

      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      className={`signUpBtn rounded-lg px-6 py-3 text-base font-medium duration-300 ease-in-out ${
        pathUrl !== "/" || sticky
          ? "bg-blue-800 bg-opacity-100 text-white hover:bg-opacity-20 hover:text-dark"
          : "bg-blue-800 bg-opacity-20 text-white hover:bg-opacity-100 hover:text-white"
      }`}
    >
      Sign Out
    </button>
  );
};

const SignInButton: React.FC<ButtonProps> = ({ sticky, pathUrl }) => (
  <Link
    href="/sign-in"
    className={`px-7 py-3 text-base font-medium hover:opacity-70 ${
      pathUrl !== "/" || sticky
        ? "dark:text-white"
        : "text-black dark:text-white"
    }`}
  >
    Sign In
  </Link>
);

const SignUpButton: React.FC<ButtonProps> = ({ sticky, pathUrl }) => (
  <Link
    href="/sign-up"
    className={`rounded-lg px-6 py-3 text-base font-medium text-white duration-300 ease-in-out ${
      pathUrl !== "/" || sticky
        ? "bg-primary hover:bg-primary/90 dark:bg-white/10 dark:hover:bg-white/20"
        : "bg-white/10 hover:bg-white/20"
    }`}
  >
    Sign Up
  </Link>
);

export default AuthButtons;
