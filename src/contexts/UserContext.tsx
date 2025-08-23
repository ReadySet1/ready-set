// src/contexts/UserContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { createClient } from "@/utils/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { UserType } from "@/types/user";

// Define user context types
type UserContextType = {
  session: Session | null;
  user: User | null;
  userRole: UserType | null;
  isLoading: boolean;
  error: string | null;
  refreshUserData: () => Promise<void>;
};

// Create the context
const UserContext = createContext<UserContextType>({
  session: null,
  user: null,
  userRole: null,
  isLoading: true,
  error: null,
  refreshUserData: async () => {},
});

// Export the hook for using the context
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

// Import auth hydration utilities
import {
  recoverAuthState,
  clearAllHydrationData,
} from "@/utils/auth/hydration";
import AuthErrorBoundary from "@/components/ErrorBoundary/AuthErrorBoundary";
import {
  retryAuthOperation,
  setCachedUserProfile,
  getCachedUserProfile,
  persistAuthState,
  getPersistedAuthState,
  clearPersistedAuthState,
} from "@/utils/supabase/client";

// Enhanced helper function to fetch user role with caching and retry
const fetchUserRole = async (
  supabase: any,
  user: User,
  setUserRole: (role: UserType) => void,
) => {
  try {
    // Check cache first
    const cachedProfile = getCachedUserProfile(user.id);
    if (cachedProfile && cachedProfile.type) {
      console.log("Using cached user profile:", cachedProfile);
      setUserRole(cachedProfile.type);
      return cachedProfile.type;
    }

    // Fetch from database with retry mechanism
    const profile = await retryAuthOperation(
      async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("type, email, name")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        return data;
      },
      {
        maxAttempts: 3,
        baseDelay: 1000,
        retryCondition: (error) => {
          // Retry on network errors but not on "not found" errors
          return (
            !error?.code?.includes("PGRST116") &&
            (error?.message?.includes("network") ||
              error?.message?.includes("timeout") ||
              error?.message?.includes("connection"))
          );
        },
      },
    );

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

    // Cache the profile data for future use (persistent across sessions)
    if (profile) {
      setCachedUserProfile(
        user.id,
        {
          type: role,
          email: profile.email || user.email,
          name:
            profile.name ||
            user.user_metadata?.name ||
            user.email?.split("@")[0],
        },
        true,
      ); // persistent = true
    }

    // Persist auth state for reliability
    if (user.email && role) {
      persistAuthState({
        userId: user.id,
        email: user.email,
        userRole: role,
        sessionData: profile,
      });
    }

    setUserRole(role);
    return role;
  } catch (err) {
    console.error("Error fetching user role:", err);

    // Try to use any persisted auth state as fallback
    const persistedState = getPersistedAuthState();
    if (
      persistedState &&
      persistedState.userId === user.id &&
      persistedState.userRole
    ) {
      console.log("Using persisted auth state as fallback:", persistedState);
      const fallbackRole = persistedState.userRole as UserType;
      setUserRole(fallbackRole);
      return fallbackRole;
    }

    return null;
  }
};

// Create a client component wrapper
function UserProviderClient({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<any>(null);
  const [hasImmediateData, setHasImmediateData] = useState(false);

  // Hydrate auth state synchronously on mount using server-side data
  useEffect(() => {
    const recoveredState = recoverAuthState();
    if (recoveredState) {
      console.log("Recovered auth state from hydration:", recoveredState);

      // Create a mock user object from recovered state
      const mockUser = {
        id: recoveredState.userId,
        email: recoveredState.email,
        user_metadata: recoveredState.profileData
          ? {
              name: recoveredState.profileData.name,
            }
          : undefined,
      } as User;

      setUser(mockUser);
      setUserRole(recoveredState.userRole);
      setHasImmediateData(true);
      setIsLoading(false); // We have hydrated data, not loading anymore

      console.log("Hydrated auth state successfully");
    }
  }, []);

  // Initialize Supabase
  useEffect(() => {
    const initSupabase = async () => {
      console.log("Initializing Supabase client...");
      try {
        const client = await createClient();
        console.log("Supabase client initialized successfully");
        setSupabase(client);
      } catch (err) {
        console.error("Failed to initialize Supabase client:", err);
        setError("Authentication initialization failed");
        if (!hasImmediateData) {
          setIsLoading(false);
        }
      }
    };

    initSupabase();
  }, [hasImmediateData]);

  // Load user data
  useEffect(() => {
    if (!supabase) {
      console.log("Waiting for Supabase client...");
      return;
    }

    console.log("Setting up auth state...");
    let mounted = true;
    let authListener: any = null;

    const setupAuth = async () => {
      try {
        console.log("UserContext: Getting initial user data...");

        // Use retry mechanism for getting user data
        const {
          data: { user: currentUser },
          error: getUserError,
        } = await retryAuthOperation(() => supabase.auth.getUser(), {
          maxAttempts: 2,
          baseDelay: 500,
          retryCondition: (error) => {
            // Retry on network errors but not on auth errors
            return (
              error?.message?.includes("network") ||
              error?.message?.includes("timeout") ||
              error?.message?.includes("connection")
            );
          },
        });

        if (!mounted) return;

        if (getUserError) {
          console.error("Error getting user:", getUserError);
          if (!hasImmediateData) {
            setIsLoading(false);
          }
          return;
        }

        if (currentUser) {
          // If we have immediate data, verify it matches current user
          if (hasImmediateData) {
            console.log(
              "UserContext: Verifying immediate data with current user...",
            );
            // Update user object with full Supabase user data
            setUser(currentUser);

            // Only fetch role from DB if hydrated data doesn't match current user ID
            const recoveredState = recoverAuthState();
            if (!recoveredState || recoveredState.userId !== currentUser.id) {
              console.log(
                "UserContext: Hydrated data mismatch, fetching fresh role...",
              );
              await fetchUserRole(supabase, currentUser, setUserRole);
            }
          } else {
            // No immediate data, fetch everything normally
            setUser(currentUser);
            console.log("UserContext: User found. Fetching user role...");
            await fetchUserRole(supabase, currentUser, setUserRole);
            setIsLoading(false);
          }
        } else {
          console.log("UserContext: No user found. Setting loading to false.");
          setUser(null);
          setUserRole(null);
          if (!hasImmediateData) {
            setIsLoading(false);
          }
        }

        const { data: listener } = supabase.auth.onAuthStateChange(
          async (_event: string, session: Session | null) => {
            if (!mounted) return;

            console.log("Auth state changed:", _event);
            setSession(session);

            const newUser = session?.user || null;
            setUser(newUser);

            if (!newUser) {
              setUserRole(null);
              setHasImmediateData(false);
              setIsLoading(false);
              // Clear all auth data when user signs out
              clearAllHydrationData();
              clearPersistedAuthState();
              return;
            }

            // Clear immediate data flag on auth state changes
            if (
              _event === "SIGNED_IN" ||
              _event === "SIGNED_OUT" ||
              _event === "TOKEN_REFRESHED"
            ) {
              if (newUser?.id !== currentUser?.id) {
                console.log("Auth state change: fetching fresh user role...");
                setHasImmediateData(false);
                setIsLoading(true);
                await fetchUserRole(supabase, newUser, setUserRole);
                setIsLoading(false);
              }
            }
          },
        );

        authListener = listener;
      } catch (error) {
        console.error("Error in auth setup:", error);
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
  }, [supabase, hasImmediateData]);

  // Function to manually refresh user data
  const refreshUserData = async () => {
    if (!supabase) return;

    // Clear all auth data when manually refreshing
    clearAllHydrationData();
    clearPersistedAuthState();
    setHasImmediateData(false);
    setIsLoading(true);

    try {
      // Use retry mechanism for refresh operation
      const {
        data: { user: currentUser },
        error: getUserError,
      } = await retryAuthOperation(() => supabase.auth.getUser(), {
        maxAttempts: 3,
        baseDelay: 1000,
        retryCondition: (error) => {
          // Retry on network/temporary errors
          return (
            error?.message?.includes("network") ||
            error?.message?.includes("timeout") ||
            error?.message?.includes("connection") ||
            error?.message?.includes("temporary")
          );
        },
      });

      if (getUserError) {
        throw getUserError;
      }

      setUser(currentUser);

      if (currentUser) {
        await fetchUserRole(supabase, currentUser, setUserRole);
      } else {
        setUserRole(null);
      }
    } catch (err) {
      console.error("Error refreshing user data:", err);
      setError("Failed to refresh user data. Please try again.");

      // Try to recover from persisted state as last resort
      try {
        const persistedState = getPersistedAuthState();
        if (persistedState) {
          console.log("Attempting recovery from persisted state...");
          const mockUser = {
            id: persistedState.userId,
            email: persistedState.email,
          } as User;

          setUser(mockUser);
          setUserRole(persistedState.userRole as UserType);
          setError(null); // Clear error if recovery succeeds
          console.log("Successfully recovered from persisted state");
        }
      } catch (recoveryError) {
        console.error("Failed to recover from persisted state:", recoveryError);
      }
    } finally {
      setIsLoading(false);
    }
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
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

// Export the provider component
export function UserProvider({ children }: { children: ReactNode }) {
  return (
    <AuthErrorBoundary
      onError={(error, errorInfo) => {
        // Log auth errors for monitoring
        console.error("Auth Error Boundary triggered:", {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
        });

        // You can add error reporting service here
        // e.g., Sentry, LogRocket, etc.
      }}
    >
      <UserProviderClient>{children}</UserProviderClient>
    </AuthErrorBoundary>
  );
}
