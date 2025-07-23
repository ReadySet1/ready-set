// src/contexts/UserContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { createClient } from "@/utils/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { UserType } from "@/types/user";
import {
  getDashboardRouteByRole,
  getOrderDetailPath as getOrderDetailPathUtil,
} from "@/utils/navigation";

// Define user context types
type UserContextType = {
  session: Session | null;
  user: User | null;
  userRole: UserType | null;
  isLoading: boolean;
  error: string | null;
  refreshUserData: () => Promise<void>;
  getDashboardPath: () => string;
  getOrderDetailPath: (orderNumber: string) => string;
};

// Create the context
const UserContext = createContext<UserContextType>({
  session: null,
  user: null,
  userRole: null,
  isLoading: true,
  error: null,
  refreshUserData: async () => {},
  getDashboardPath: () => "/",
  getOrderDetailPath: (orderNumber: string) => "/",
});

// Export the hook for using the context
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

// Initialize Supabase client outside the component
const supabaseClient = createClient();

// Create a client component wrapper
function UserProviderClient({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Memoized function to fetch user role with retry logic
  const fetchUserRoleWithRetry = useCallback(
    async (supabase: any, user: User) => {
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 1000; // 1 second

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`[UserContext] Fetching user role, attempt ${attempt}`);
          const { data: profile } = await supabase
            .from("profiles")
            .select("type")
            .eq("id", user.id)
            .single();

          let role = UserType.CLIENT;
          if (profile?.type) {
            const typeUpper = profile.type.toUpperCase();
            const enumValues = Object.values(UserType).map((val) =>
              val.toUpperCase(),
            );

            if (enumValues.includes(typeUpper)) {
              const originalEnumValue = Object.values(UserType).find(
                (val) => val.toUpperCase() === typeUpper,
              );
              role = originalEnumValue as UserType;
            }
          }

          console.log(`[UserContext] User role fetched successfully: ${role}`);
          return role;
        } catch (err) {
          console.warn(
            `[UserContext] User role fetch attempt ${attempt} failed:`,
            err,
          );

          if (attempt === MAX_RETRIES) {
            console.error(
              "[UserContext] Failed to fetch user role after max retries",
            );
            return null;
          }

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        }
      }

      return null;
    },
    [],
  );

  // Enhanced auth state setup with improved error handling and session persistence
  useEffect(() => {
    let mounted = true;
    let authListener: any = null;

    const setupAuth = async () => {
      try {
        console.log("[UserContext] Starting authentication setup");
        const supabase = supabaseClient;

        // Get initial session and user data
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        const {
          data: { user: currentUser },
          error: getUserError,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (getUserError) {
          console.error("[UserContext] Error getting user:", getUserError);
          throw getUserError;
        }

        console.log("[UserContext] Initial auth state:", {
          hasSession: !!initialSession,
          hasUser: !!currentUser,
          userId: currentUser?.id,
        });

        // Set session first
        setSession(initialSession);

        if (currentUser) {
          console.log("[UserContext] Setting authenticated user");
          setUser(currentUser);

          // Fetch user role with loading state
          setIsLoading(true);
          const role = await fetchUserRoleWithRetry(supabase, currentUser);
          if (role) {
            setUserRole(role);
          }
        } else {
          console.log("[UserContext] No authenticated user found");
          // Explicitly set user to null when no authentication
          setUser(null);
          setUserRole(null);
        }

        // Mark auth as initialized and set loading to false
        setAuthInitialized(true);
        setIsLoading(false);
        console.log("[UserContext] Authentication setup completed");

        // Set up auth state change listener
        const { data: listener } = supabase.auth.onAuthStateChange(
          async (event: string, session: Session | null) => {
            if (!mounted) return;

            console.log(`[UserContext] Auth state change: ${event}`, {
              hasSession: !!session,
              hasUser: !!session?.user,
              userId: session?.user?.id,
            });

            setSession(session);
            const newUser = session?.user || null;
            setUser(newUser);

            if (!newUser) {
              console.log("[UserContext] User signed out, clearing state");
              setUserRole(null);
              setIsLoading(false);
              return;
            }

            // Only fetch role if user changed or we don't have a role yet
            if (newUser?.id !== currentUser?.id || !userRole) {
              console.log("[UserContext] Fetching role for new/changed user");
              setIsLoading(true);
              const role = await fetchUserRoleWithRetry(supabase, newUser);
              if (role) {
                setUserRole(role);
              }
              setIsLoading(false);
            }
          },
        );

        authListener = listener;
      } catch (error) {
        console.error("[UserContext] Authentication setup failed:", error);
        if (mounted) {
          setError("Authentication setup failed");
          setAuthInitialized(true);
          setIsLoading(false);
        }
      }
    };

    setupAuth();

    return () => {
      mounted = false;
      if (authListener) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [fetchUserRoleWithRetry]); // Include fetchUserRoleWithRetry in dependencies

  // Enhanced refresh user data with retry logic
  const refreshUserData = useCallback(async () => {
    try {
      console.log("[UserContext] Refreshing user data");
      const supabase = supabaseClient;

      setIsLoading(true);
      setError(null);

      const {
        data: { user: currentUser },
        error: getUserError,
      } = await supabase.auth.getUser();

      if (getUserError) {
        throw getUserError;
      }

      setUser(currentUser);

      if (currentUser) {
        const role = await fetchUserRoleWithRetry(supabase, currentUser);
        if (role) {
          setUserRole(role);
        }
      } else {
        setUserRole(null);
      }

      console.log("[UserContext] User data refreshed successfully");
    } catch (err) {
      console.error("[UserContext] Error refreshing user data:", err);
      setError("Failed to refresh user data");
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserRoleWithRetry]);

  // Navigation helpers
  const getDashboardPath = () => {
    if (!userRole) return "/";
    return getDashboardRouteByRole(userRole).path;
  };

  const getOrderDetailPath = (orderNumber: string) => {
    if (!userRole) return "/";
    return getOrderDetailPathUtil(orderNumber, userRole);
  };

  // Enhanced loading state - only show loading if auth is not initialized
  const effectiveLoading = isLoading || !authInitialized;

  return (
    <UserContext.Provider
      value={{
        session,
        user,
        userRole,
        isLoading: effectiveLoading,
        error,
        refreshUserData,
        getDashboardPath,
        getOrderDetailPath,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

// Export the provider component
export function UserProvider({ children }: { children: ReactNode }) {
  return <UserProviderClient>{children}</UserProviderClient>;
}
