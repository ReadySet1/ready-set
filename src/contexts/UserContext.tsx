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
import { authLogger } from "@/utils/logger";

// Define user context types
type UserContextType = {
  session: Session | null;
  user: User | null;
  userRole: UserType | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticating: boolean;
  authProgress: {
    step:
      | "idle"
      | "connecting"
      | "authenticating"
      | "fetching_profile"
      | "redirecting"
      | "complete";
    message: string;
  };
  refreshUserData: () => Promise<void>;
  clearAuthError: () => void;
  setAuthProgress: (
    step: UserContextType["authProgress"]["step"],
    message?: string,
  ) => void;
};

// Create the context
export const UserContext = createContext<UserContextType>({
  session: null,
  user: null,
  userRole: null,
  isLoading: true,
  error: null,
  isAuthenticating: false,
  authProgress: { step: "idle", message: "" },
  refreshUserData: async () => {},
  clearAuthError: () => {},
  setAuthProgress: () => {},
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
      if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
        console.log("Using cached user profile:", cachedProfile);
      }
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
  authLogger.debug(
    "🟢 UserProviderClient MOUNTING - this should appear first!",
  );

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authProgress, setAuthProgressState] = useState<{
    step:
      | "idle"
      | "connecting"
      | "authenticating"
      | "fetching_profile"
      | "redirecting"
      | "complete";
    message: string;
  }>({ step: "idle", message: "" });
  const [supabase, setSupabase] = useState<any>(null);
  const [hasImmediateData, setHasImmediateData] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  authLogger.debug(
    "🟢 UserProviderClient state initialized - user:",
    !!user,
    "isLoading:",
    isLoading,
  );

  // 🔥 IMMEDIATE COOKIE CHECK (NOT in useEffect) - executes during render
  // Only run on client after hydration to prevent server/client mismatches
  if (
    typeof window !== "undefined" &&
    isHydrated &&
    !user &&
    !hasImmediateData
  ) {
    if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
      console.log("🔥 IMMEDIATE cookie check during render...");
    }
    const cookies = document.cookie;
    const sessionMatch = cookies.match(/user-session-data=([^;]+)/);

    if (sessionMatch && sessionMatch[1]) {
      try {
        const decoded = decodeURIComponent(sessionMatch[1]);
        const sessionData = JSON.parse(decoded);
        if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
          console.log("🔥 IMMEDIATE: Found session data:", sessionData);
        }

        if (sessionData.userId && sessionData.email && sessionData.userRole) {
          if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
            console.log("🔥 IMMEDIATE: Setting user state immediately!");
          }

          const mockUser = {
            id: sessionData.userId,
            email: sessionData.email,
            user_metadata: {
              name: sessionData.email?.split("@")[0] || "User",
            },
          } as unknown as User;

          const normalizedRole = sessionData.userRole.toLowerCase() as UserType;

          // Set state in next tick to avoid render phase issues
          if (!user) {
            setTimeout(() => {
              setUser(mockUser);
              setUserRole(normalizedRole);
              setHasImmediateData(true);
              setIsLoading(false);
              if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
                console.log("🔥 IMMEDIATE: Auth state set successfully!");
              }
            }, 0);
          }
        }
      } catch (error) {
        if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
          console.error("🔥 IMMEDIATE: Failed to parse cookie:", error);
        }
      }
    } else {
      if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
        console.log("🔥 IMMEDIATE: No session cookie found");
      }
    }
  }

  // Set hydration flag to prevent server/client mismatches
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Hydrate auth state synchronously on mount using server-side data
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
      console.log("🚀🚀🚀 FORCED UserContext useEffect TRIGGERED!");
      console.log("🚀🚀🚀 FORCED UserContext: Starting hydration check...");
      console.log("🚀 Window available?", typeof window !== "undefined");
    }

    // Force check cookies directly as backup
    if (typeof window !== "undefined") {
      const cookies = document.cookie;
      if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
        console.log("🍪 FORCED Cookie check - length:", cookies.length);
        console.log("🍪 FORCED Cookie preview:", cookies.substring(0, 200));
      }

      // Manual cookie parsing as backup
      const sessionMatch = cookies.match(/user-session-data=([^;]+)/);
      if (sessionMatch && sessionMatch[1]) {
        if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
          console.log("🔍 FORCED Found session cookie manually!");
        }
        try {
          const decoded = decodeURIComponent(sessionMatch[1]);
          const sessionData = JSON.parse(decoded);
          if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
            console.log("📊 FORCED Manual session data:", sessionData);
          }

          if (sessionData.userId && sessionData.email && sessionData.userRole) {
            if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
              console.log("✅ FORCED Creating user from manual parsing...");
            }

            // Create user object directly from cookie data
            const mockUser = {
              id: sessionData.userId,
              email: sessionData.email,
              user_metadata: {
                name: sessionData.email?.split("@")[0] || "User",
              },
            } as unknown as User;

            // Normalize userRole to lowercase
            const normalizedRole =
              sessionData.userRole.toLowerCase() as UserType;

            setTimeout(() => {
              setUser(mockUser);
              setUserRole(normalizedRole);
              setHasImmediateData(true);
              setIsLoading(false);
              if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
                console.log(
                  "✅ FORCED Hydrated auth state successfully with manual parsing!",
                );
              }
            }, 0);
            return; // Exit early since we found the data
          }
        } catch (error) {
          if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
            console.error("❌ FORCED Manual parsing failed:", error);
          }
        }
      }
    }

    // Fallback to original method
    const recoveredState = recoverAuthState();
    if (recoveredState) {
      if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
        console.log("✅ Recovered auth state from hydration:", recoveredState);
      }

      // Create a mock user object from recovered state
      const mockUser = {
        id: recoveredState.userId,
        email: recoveredState.email,
        user_metadata: recoveredState.profileData
          ? {
              name: recoveredState.profileData.name,
            }
          : undefined,
      } as unknown as User;

      setTimeout(() => {
        setUser(mockUser);
        setUserRole(recoveredState.userRole);
        setHasImmediateData(true);
        setIsLoading(false); // We have hydrated data, not loading anymore
      }, 0);

      if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
        console.log(
          "✅ Hydrated auth state successfully - user should be visible in header",
        );
      }
    } else {
      if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
        console.log("❌ No auth state found during hydration check");
      }
    }
  }, []);

  // Initialize Supabase
  useEffect(() => {
    const initSupabase = async () => {
      if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
        console.log("🔌 UserContext: Initializing Supabase client...");
      }
      setAuthProgressState({
        step: "connecting",
        message: "Connecting to authentication service...",
      });

      try {
        const client = await createClient();
        if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
          console.log("✅ UserContext: Supabase client initialized successfully");
        }
        setSupabase(client);
        setAuthProgressState({ step: "idle", message: "" });
      } catch (err) {
        console.error(
          "❌ UserContext: Failed to initialize Supabase client:",
          err,
        );
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
      console.log("⏳ UserContext: Waiting for Supabase client...");
      return;
    }

    console.log("Setting up auth state...");
    let mounted = true;
    let authListener: any = null;

    const setupAuth = async () => {
      try {
        console.log("UserContext: Getting initial user data...");

        // Add a small delay to allow middleware session refresh to complete
        // especially important after login redirects
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Use retry mechanism for getting user data
        const {
          data: { user: currentUser },
          error: getUserError,
        } = await retryAuthOperation<{
          data: { user: User | null };
          error: any;
        }>(() => supabase.auth.getUser(), {
          maxAttempts: 3,
          baseDelay: 500,
          retryCondition: (error) => {
            // Retry on network errors AND session missing errors (which can happen during login transitions)
            return (
              error?.message?.includes("network") ||
              error?.message?.includes("timeout") ||
              error?.message?.includes("connection") ||
              error?.message?.includes("Auth session missing")
            );
          },
        });

        if (!mounted) return;

        if (getUserError) {
          console.error("❌ Error getting user:", getUserError);

        // If we have immediate hydration data but Supabase session is missing,
        // try to recover gracefully without showing error immediately
        if (
          hasImmediateData &&
          getUserError.message?.includes("Auth session missing")
        ) {
          if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
            console.log(
              "⚠️  Session missing but we have hydration data, continuing with hydrated state",
            );
          }
          // Don't set error or stop loading immediately, let hydration data work
          return;
        }

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
          console.log(
            "ℹ️ UserContext: No user found. Setting loading to false.",
          );
          setUser(null);
          setUserRole(null);
          if (!hasImmediateData) {
            setIsLoading(false);
          }
        }

        const { data: listener } = supabase.auth.onAuthStateChange(
          async (event: string, session: Session | null) => {
            if (!mounted) return;

            console.log("Auth state changed:", event);
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
              event === "SIGNED_IN" ||
              event === "SIGNED_OUT" ||
              event === "TOKEN_REFRESHED"
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
        console.error("💥 UserContext: Error in auth setup:", error);
        if (mounted) {
          setError("Authentication setup failed");
          setIsLoading(false);
          setAuthProgressState({ step: "idle", message: "" });
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
      } = await retryAuthOperation<{ data: { user: User | null }; error: any }>(
        () => supabase.auth.getUser(),
        {
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
        },
      );

      if (getUserError) {
        throw getUserError;
      }

      setUser(currentUser);

      if (currentUser) {
        await fetchUserRole(supabase, currentUser, setUserRole);
      } else {
        setUserRole(null);
        setAuthProgressState({ step: "idle", message: "" });
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
      // Reset to idle after showing completion
      setTimeout(
        () => setAuthProgressState({ step: "idle", message: "" }),
        1000,
      );
    }
  };

  // Prevent hydration mismatches by ensuring consistent initial render
  if (!isHydrated) {
    return (
      <UserContext.Provider
        value={{
          session: null,
          user: null,
          userRole: null,
          isLoading: true,
          error: null,
          isAuthenticating: false,
          authProgress: { step: "idle", message: "" },
          refreshUserData,
          clearAuthError: () => {},
          setAuthProgress: () => {},
        }}
      >
        {children}
      </UserContext.Provider>
    );
  }

  return (
    <UserContext.Provider
      value={{
        session,
        user,
        userRole,
        isLoading,
        error,
        isAuthenticating,
        authProgress,
        refreshUserData,
        clearAuthError: () => setError(null),
        setAuthProgress: (step, message = "") =>
          setAuthProgressState({ step, message }),
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

// Export the provider component
export function UserProvider({ children }: { children: ReactNode }) {
  authLogger.debug("🔵 UserProvider wrapper called!");
  return (
    <AuthErrorBoundary
      onError={(error, errorInfo) => {
        // Log auth errors for monitoring
        console.error("🚨 Auth Error Boundary triggered:", {
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
