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

  // Memoized function to fetch user role with retry logic
  const fetchUserRoleWithRetry = useCallback(
    async (supabase: any, user: User) => {
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 1000; // 1 second

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
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

          return role;
        } catch (err) {
          console.warn(`User role fetch attempt ${attempt} failed:`, err);

          if (attempt === MAX_RETRIES) {
            console.error("Failed to fetch user role after max retries");
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

  // Simplified auth state setup with improved error handling
  useEffect(() => {
    let mounted = true;
    let authListener: any = null;

    const setupAuth = async () => {
      try {
        const supabase = await supabaseClient;

        // Get initial user data
        const {
          data: { user: currentUser },
          error: getUserError,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (getUserError) {
          throw getUserError;
        }

        if (currentUser) {
          setUser(currentUser);
          const role = await fetchUserRoleWithRetry(supabase, currentUser);
          if (role) {
            setUserRole(role);
          }
        }

        setIsLoading(false);

        // Set up auth state change listener
        const { data: listener } = supabase.auth.onAuthStateChange(
          async (_event: string, session: Session | null) => {
            if (!mounted) return;

            setSession(session);

            const newUser = session?.user || null;
            setUser(newUser);

            if (!newUser) {
              setUserRole(null);
              return;
            }

            if (newUser?.id !== currentUser?.id) {
              const role = await fetchUserRoleWithRetry(supabase, newUser);
              if (role) {
                setUserRole(role);
              }
            }
          },
        );

        authListener = listener;
      } catch (error) {
        console.error("Authentication setup failed:", error);
        if (mounted) {
          setError("Authentication setup failed");
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
  }, []); // Empty dependency array ensures this runs only once

  // Improved refresh user data with retry logic
  const refreshUserData = useCallback(async () => {
    try {
      const supabase = await supabaseClient;

      setIsLoading(true);
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
    } catch (err) {
      console.error("Error refreshing user data:", err);
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

  return (
    <UserContext.Provider
      value={{
        session,
        user,
        userRole,
        isLoading,
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
