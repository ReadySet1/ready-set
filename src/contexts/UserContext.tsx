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

// Import enhanced authentication services
import { getSessionManager } from "@/lib/auth/session-manager";
import { getTokenRefreshService } from "@/lib/auth/token-refresh-service";
import { getAuthenticatedFetch } from "@/lib/auth/api-interceptor";
import {
  AuthState,
  AuthContextConfig,
  AuthError,
  AuthErrorType,
  DEFAULT_AUTH_CONFIG,
  SessionFingerprint,
  EnhancedSession,
} from "@/types/auth";

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

// Define enhanced user context types
type UserContextType = {
  session: Session | null;
  user: User | null;
  userRole: UserType | null;
  enhancedSession: EnhancedSession | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticating: boolean;
  authState: AuthState;
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
  // Enhanced methods
  refreshUserData: () => Promise<void>;
  refreshToken: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
  setAuthProgress: (
    step: UserContextType["authProgress"]["step"],
    message?: string,
  ) => void;
  // Session management
  getActiveSessions: () => Promise<EnhancedSession[]>;
  revokeSession: (sessionId: string) => Promise<void>;
  // Activity tracking
  updateActivity: () => void;
};

// Create the context
export const UserContext = createContext<UserContextType>({
  session: null,
  user: null,
  userRole: null,
  enhancedSession: null,
  isLoading: true,
  error: null,
  isAuthenticating: false,
  authState: {
    user: null,
    session: null,
    enhancedSession: null,
    userRole: null,
    isLoading: true,
    isAuthenticating: false,
    error: null,
    lastActivity: Date.now(),
    sessionExpiresAt: null,
    needsRefresh: false,
    suspiciousActivity: false,
  },
  authProgress: { step: "idle", message: "" },
  refreshUserData: async () => {},
  refreshToken: async () => {},
  logout: async () => {},
  clearAuthError: () => {},
  setAuthProgress: () => {},
  getActiveSessions: async () => [],
  revokeSession: async () => {},
  updateActivity: () => {},
});

// Export the hook for using the context
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

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
  authLogger.debug(
    "🟢 UserProviderClient MOUNTING - Enhanced version with session management!",
  );

  // Core state
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserType | null>(null);
  const [enhancedSession, setEnhancedSession] =
    useState<EnhancedSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Enhanced state
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    enhancedSession: null,
    userRole: null,
    isLoading: true,
    isAuthenticating: false,
    error: null,
    lastActivity: Date.now(),
    sessionExpiresAt: null,
    needsRefresh: false,
    suspiciousActivity: false,
  });

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

  // Services
  const [supabase, setSupabase] = useState<any>(null);
  const [sessionManager, setSessionManager] = useState<any>(null);
  const [hasImmediateData, setHasImmediateData] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  authLogger.debug(
    "🟢 UserProviderClient state initialized - user:",
    !!user,
    "isLoading:",
    isLoading,
  );

  // Initialize services
  useEffect(() => {
    const initServices = async () => {
      try {
        setAuthProgressState({
          step: "connecting",
          message: "Initializing authentication services...",
        });

        // Add timeout for service initialization
        const initTimeout = setTimeout(() => {
          console.log("🔥 UserProviderClient: Service initialization timeout");
          setAuthProgressState({ step: "idle", message: "" });
          if (!hasImmediateData) {
            setIsLoading(false);
          }
        }, 5000); // 5 second timeout

        const client = await createClient();
        setSupabase(client);

        // Initialize session manager
        const sm = getSessionManager();
        setSessionManager(sm);

        // Initialize token refresh service
        getTokenRefreshService();

        clearTimeout(initTimeout);
        setAuthProgressState({ step: "idle", message: "" });
        authLogger.debug(
          "UserProviderClient: Services initialized successfully",
        );
      } catch (err) {
        console.error(
          "UserProviderClient: Failed to initialize services:",
          err,
        );
        setError("Authentication initialization failed");
        if (!hasImmediateData) {
          setIsLoading(false);
        }
      }
    };

    initServices();
  }, [hasImmediateData]);

  // Hydration and immediate data loading
  useEffect(() => {
    console.log("🚀🚀🚀 ENHANCED UserContext useEffect TRIGGERED!");
    console.log("🚀🚀🚀 ENHANCED UserContext: Starting hydration check...");
    console.log("🚀 Window available?", typeof window !== "undefined");

    // Set hydration flag to prevent server/client mismatches
    setIsHydrated(true);

    // Force check cookies directly as backup
    if (typeof window !== "undefined") {
      const cookies = document.cookie;
      console.log("🍪 ENHANCED Cookie check - length:", cookies.length);
      console.log("🍪 ENHANCED Cookie preview:", cookies.substring(0, 200));

      // Manual cookie parsing as backup
      const sessionMatch = cookies.match(/user-session-data=([^;]+)/);
      if (sessionMatch && sessionMatch[1]) {
        console.log("🔍 ENHANCED Found session cookie manually!");
        try {
          const decoded = decodeURIComponent(sessionMatch[1]);
          const sessionData = JSON.parse(decoded);
          console.log("📊 ENHANCED Manual session data:", sessionData);

          if (sessionData.userId && sessionData.email && sessionData.userRole) {
            console.log("✅ ENHANCED Creating user from manual parsing...");

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
              console.log(
                "✅ ENHANCED Hydrated auth state successfully with manual parsing!",
              );
            }, 0);
            return; // Exit early since we found the data
          }
        } catch (error) {
          console.error("❌ ENHANCED Manual parsing failed:", error);
        }
      }
    }

    // Fallback to original method
    const recoveredState = recoverAuthState();
    if (recoveredState) {
      console.log(
        "✅ ENHANCED Recovered auth state from hydration:",
        recoveredState,
      );

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

      console.log(
        "✅ ENHANCED Hydrated auth state successfully - user should be visible in header",
      );
    } else {
      console.log("❌ ENHANCED No auth state found during hydration check");
    }
  }, []);

  // Enhanced auth state management
  useEffect(() => {
    if (!supabase || !sessionManager) {
      console.log("⏳ UserProviderClient: Waiting for services...");
      return;
    }

    console.log("Setting up enhanced auth state...");
    let mounted = true;
    let authListener: any = null;

    const setupAuth = async () => {
      let authTimeout: NodeJS.Timeout | null = null;

      try {
        console.log("UserProviderClient: Getting initial user data...");

        // First, quickly check if there's any session data available
        const { data: sessionData } = await supabase.auth.getSession();

        // If no session exists, immediately set loading to false - no need to authenticate
        if (!sessionData?.session) {
          console.log(
            "ℹ️ No session found - user not authenticated, setting loading to false immediately",
          );
          setIsLoading(false);
          setAuthProgressState({ step: "idle", message: "" });
          setAuthState((prev) => ({
            ...prev,
            isLoading: false,
            isAuthenticating: false,
            error: null,
          }));
          return;
        }

        setAuthProgressState({
          step: "authenticating",
          message: "Verifying authentication status...",
        });

        // Add a timeout to prevent infinite loading
        authTimeout = setTimeout(() => {
          if (mounted) {
            console.log(
              "🔥 UserProviderClient: Auth setup timeout - forcing completion",
            );
            setIsLoading(false);
            setAuthProgressState({ step: "idle", message: "" });
          }
        }, 10000); // 10 second timeout

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
            // Only retry on network/temporary errors, NOT on auth session missing
            return (
              error?.message?.includes("network") ||
              error?.message?.includes("timeout") ||
              error?.message?.includes("connection") ||
              error?.message?.includes("temporary") ||
              error?.message?.includes("rate limit") ||
              error?.message?.includes("server error")
            );
          },
        });

        if (!mounted) {
          clearTimeout(authTimeout);
          return;
        }

        if (!mounted) {
          clearTimeout(authTimeout);
          return;
        }

        if (getUserError) {
          console.error("❌ Error getting user:", getUserError);
          clearTimeout(authTimeout);

          // Handle "Auth session missing" error - this is expected for non-authenticated users
          if (getUserError.message?.includes("Auth session missing")) {
            console.log(
              "ℹ️ Auth session missing - user not authenticated, this is expected",
            );

            // Clear any existing auth progress
            setAuthProgressState({ step: "idle", message: "" });

            // Set loading to false since we don't need to authenticate
            setIsLoading(false);
            setAuthState((prev) => ({
              ...prev,
              isLoading: false,
              isAuthenticating: false,
              error: null,
            }));

            // Don't return early - let the rest of the logic handle the null user case
          } else {
            // For other errors, handle them normally
            if (!hasImmediateData) {
              setIsLoading(false);
              setAuthProgressState({ step: "idle", message: "" });
            }
            return;
          }
        }

        if (currentUser) {
          let currentEnhancedSession: EnhancedSession | null = null;
          let currentUserRole: UserType | null = null;
          let currentSession: Session | null = null;

          // If we have immediate data, verify it matches current user
          if (hasImmediateData) {
            console.log(
              "UserProviderClient: Verifying immediate data with current user...",
            );
            // Update user object with full Supabase user data
            setUser(currentUser);

            // Initialize enhanced session
            try {
              const sessionData = await supabase.auth.getSession();
              if (sessionData.data.session) {
                const enhanced = await sessionManager.initializeFromSession(
                  sessionData.data.session,
                  currentUser,
                );
                currentEnhancedSession = enhanced;
                currentSession = sessionData.data.session;
                setEnhancedSession(enhanced);
                setSession(sessionData.data.session);

                // Start token refresh service
                const tokenRefreshService = getTokenRefreshService();
                tokenRefreshService.startAutoRefresh(sessionData.data.session);
              }
            } catch (sessionError) {
              console.error(
                "Error initializing enhanced session:",
                sessionError,
              );
            }

            // Only fetch role from DB if hydrated data doesn't match current user ID
            const recoveredState = recoverAuthState();
            if (!recoveredState || recoveredState.userId !== currentUser.id) {
              console.log(
                "UserProviderClient: Hydrated data mismatch, fetching fresh role...",
              );
              currentUserRole = await fetchUserRole(
                supabase,
                currentUser,
                setUserRole,
              );
            } else {
              currentUserRole = recoveredState.userRole; // Use existing role if data matches
            }
          } else {
            // No immediate data, fetch everything normally
            setUser(currentUser);

            // Initialize enhanced session
            try {
              const sessionData = await supabase.auth.getSession();
              if (sessionData.data.session) {
                const enhanced = await sessionManager.initializeFromSession(
                  sessionData.data.session,
                  currentUser,
                );
                currentEnhancedSession = enhanced;
                currentSession = sessionData.data.session;
                setEnhancedSession(enhanced);
                setSession(sessionData.data.session);

                // Start token refresh service
                const tokenRefreshService = getTokenRefreshService();
                tokenRefreshService.startAutoRefresh(sessionData.data.session);
              }
            } catch (sessionError) {
              console.error(
                "Error initializing enhanced session:",
                sessionError,
              );
            }

            console.log(
              "UserProviderClient: User found. Fetching user role...",
            );
            currentUserRole = await fetchUserRole(
              supabase,
              currentUser,
              setUserRole,
            );
            setIsLoading(false);
          }

          // Update auth state using local variables instead of state variables
          setAuthState((prev) => ({
            ...prev,
            user: currentUser,
            session: currentSession,
            enhancedSession: currentEnhancedSession,
            userRole: currentUserRole,
            isLoading: false,
            isAuthenticating: false,
            error: null,
            lastActivity: Date.now(),
            sessionExpiresAt: currentSession?.expires_at
              ? currentSession.expires_at * 1000
              : null,
          }));
        } else {
          console.log(
            "ℹ️ UserProviderClient: No user found. Setting loading to false.",
          );
          clearTimeout(authTimeout);
          setUser(null);
          setUserRole(null);
          setEnhancedSession(null);
          setSession(null);

          // Update auth state
          setAuthState((prev) => ({
            ...prev,
            user: null,
            session: null,
            enhancedSession: null,
            userRole: null,
            isLoading: false,
            isAuthenticating: false,
            error: null,
          }));

          if (!hasImmediateData) {
            setIsLoading(false);
          }
        }

        // Set up auth state change listener
        const { data: listener } = supabase.auth.onAuthStateChange(
          async (event: string, session: Session | null) => {
            if (!mounted) return;

            console.log("Enhanced Auth state changed:", event);
            setSession(session);

            const newUser = session?.user || null;
            setUser(newUser);

            if (!newUser) {
              setUserRole(null);
              setEnhancedSession(null);
              setHasImmediateData(false);
              setIsLoading(false);

              // Clear all auth data when user signs out
              clearAllHydrationData();
              clearPersistedAuthState();

              // Stop token refresh
              const tokenRefreshService = getTokenRefreshService();
              tokenRefreshService.stopAutoRefresh();

              // Clear enhanced session
              if (sessionManager) {
                await sessionManager.clearSession();
              }

              // Update auth state
              setAuthState((prev) => ({
                ...prev,
                user: null,
                session: null,
                enhancedSession: null,
                userRole: null,
                isLoading: false,
                isAuthenticating: false,
                error: null,
              }));

              return;
            }

            // Initialize enhanced session for new sign-in
            if (event === "SIGNED_IN" && session && sessionManager) {
              try {
                const enhanced = await sessionManager.initializeFromSession(
                  session,
                  newUser,
                );
                setEnhancedSession(enhanced);

                // Start token refresh service
                const tokenRefreshService = getTokenRefreshService();
                tokenRefreshService.startAutoRefresh(session);

                // Update auth state
                setAuthState((prev) => ({
                  ...prev,
                  user: newUser,
                  session,
                  enhancedSession: enhanced,
                  isLoading: false,
                  isAuthenticating: false,
                  error: null,
                  lastActivity: Date.now(),
                  sessionExpiresAt: session.expires_at
                    ? session.expires_at * 1000
                    : null,
                }));
              } catch (sessionError) {
                console.error(
                  "Error initializing enhanced session on sign-in:",
                  sessionError,
                );
              }
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
                const newUserRole = await fetchUserRole(
                  supabase,
                  newUser,
                  setUserRole,
                );
                setIsLoading(false);

                // Update auth state
                setAuthState((prev) => ({
                  ...prev,
                  user: newUser,
                  userRole: newUserRole, // Use the locally captured value
                  lastActivity: Date.now(),
                }));
              }
            }
          },
        );

        authListener = listener;
      } catch (error) {
        console.error("💥 UserProviderClient: Error in auth setup:", error);
        if (authTimeout) {
          clearTimeout(authTimeout);
        }
        if (mounted) {
          setError("Authentication setup failed");
          setIsLoading(false);
          setAuthProgressState({ step: "idle", message: "" });

          // Update auth state
          setAuthState((prev) => ({
            ...prev,
            error: "Authentication setup failed",
            isLoading: false,
            isAuthenticating: false,
          }));
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
  }, [supabase, sessionManager, hasImmediateData]);

  // Enhanced methods
  const refreshUserData = async () => {
    if (!supabase) return;

    // Clear all auth data when manually refreshing
    clearAllHydrationData();
    clearPersistedAuthState();
    setHasImmediateData(false);
    setIsLoading(true);

    setAuthProgressState({
      step: "authenticating",
      message: "Refreshing user data...",
    });

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

        // Update auth state
        setAuthState((prev) => ({
          ...prev,
          user: currentUser,
          userRole,
          lastActivity: Date.now(),
        }));
      } else {
        setUserRole(null);

        // Update auth state
        setAuthState((prev) => ({
          ...prev,
          user: null,
          userRole: null,
        }));
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

          // Update auth state
          setAuthState((prev) => ({
            ...prev,
            user: mockUser,
            userRole: persistedState.userRole as UserType,
            error: null,
          }));
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

  const refreshToken = async () => {
    if (!sessionManager) return;

    setAuthProgressState({
      step: "authenticating",
      message: "Refreshing authentication token...",
    });

    try {
      await sessionManager.refreshToken();
      console.log("Token refreshed successfully");
    } catch (error) {
      console.error("Token refresh failed:", error);
      setError("Failed to refresh authentication token");

      // Update auth state
      setAuthState((prev) => ({
        ...prev,
        error: "Failed to refresh authentication token",
        needsRefresh: true,
      }));
    } finally {
      setAuthProgressState({ step: "idle", message: "" });
    }
  };

  const logout = async () => {
    if (!supabase || !sessionManager) return;

    setAuthProgressState({
      step: "authenticating",
      message: "Signing out...",
    });

    try {
      // Stop token refresh service
      const tokenRefreshService = getTokenRefreshService();
      tokenRefreshService.stopAutoRefresh();

      // Clear enhanced session
      await sessionManager.clearSession();

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Clear local state
      setUser(null);
      setUserRole(null);
      setEnhancedSession(null);
      setSession(null);
      setHasImmediateData(false);

      // Clear all auth data
      clearAllHydrationData();
      clearPersistedAuthState();

      // Update auth state
      setAuthState({
        user: null,
        session: null,
        enhancedSession: null,
        userRole: null,
        isLoading: false,
        isAuthenticating: false,
        error: null,
        lastActivity: Date.now(),
        sessionExpiresAt: null,
        needsRefresh: false,
        suspiciousActivity: false,
      });

      console.log("Logout completed successfully");
    } catch (error) {
      console.error("Logout error:", error);
      setError("Failed to sign out properly");

      // Update auth state
      setAuthState((prev) => ({
        ...prev,
        error: "Failed to sign out properly",
      }));
    } finally {
      setAuthProgressState({ step: "idle", message: "" });
    }
  };

  const getActiveSessions = async (): Promise<EnhancedSession[]> => {
    if (!sessionManager) return [];
    return await sessionManager.getActiveSessions();
  };

  const revokeSession = async (sessionId: string): Promise<void> => {
    if (!sessionManager) return;
    await sessionManager.revokeSession(sessionId);
  };

  const updateActivity = () => {
    if (sessionManager) {
      sessionManager.synchronizeTabs();
    }

    // Update auth state
    setAuthState((prev) => ({
      ...prev,
      lastActivity: Date.now(),
    }));
  };

  // Prevent hydration mismatches by ensuring consistent initial render
  if (!isHydrated) {
    return (
      <UserContext.Provider
        value={{
          session: null,
          user: null,
          userRole: null,
          enhancedSession: null,
          isLoading: true,
          error: null,
          isAuthenticating: false,
          authState: {
            user: null,
            session: null,
            enhancedSession: null,
            userRole: null,
            isLoading: true,
            isAuthenticating: false,
            error: null,
            lastActivity: Date.now(),
            sessionExpiresAt: null,
            needsRefresh: false,
            suspiciousActivity: false,
          },
          authProgress: { step: "idle", message: "" },
          refreshUserData,
          refreshToken,
          logout,
          clearAuthError: () => {},
          setAuthProgress: () => {},
          getActiveSessions,
          revokeSession,
          updateActivity,
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
        enhancedSession,
        isLoading,
        error,
        isAuthenticating,
        authState,
        authProgress,
        refreshUserData,
        refreshToken,
        logout,
        clearAuthError: () => setError(null),
        setAuthProgress: (step, message = "") =>
          setAuthProgressState({ step, message }),
        getActiveSessions,
        revokeSession,
        updateActivity,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

// Export the provider component
export function UserProvider({ children }: { children: ReactNode }) {
  authLogger.debug("🔵 Enhanced UserProvider wrapper called!");
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
