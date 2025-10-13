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

// Import enhanced authentication services (session manager loaded dynamically)
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
    // Try to use any persisted auth state as fallback
    const persistedState = getPersistedAuthState();
    if (
      persistedState &&
      persistedState.userId === user.id &&
      persistedState.userRole
    ) {
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
          setAuthProgressState({ step: "idle", message: "" });
          if (!hasImmediateData) {
            setIsLoading(false);
          }
        }, 5000); // 5 second timeout

        const client = await createClient();
        setSupabase(client);

        // Initialize session manager (client-side only)
        const { getSessionManager } = await import(
          "@/lib/auth/session-manager"
        );
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
        setError("Authentication initialization failed");
        if (!hasImmediateData) {
          setIsLoading(false);
        }
      }
    };

    initServices();
  }, [hasImmediateData]);

  // Simplified hydration - check cookies first, then Supabase session with retry mechanism
  useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout | null = null;

    const checkSupabaseSession = async (retryCount = 0) => {
      if (!mounted) return;

      try {
        // FAST PATH: Check for session cookies first (set by login action)
        // This provides immediate hydration while we wait for Supabase session
        if (retryCount === 0) {
          try {
            const tempSessionCookie = document.cookie
              .split("; ")
              .find((row) => row.startsWith("temp-session-data="));

            const sessionCookie = document.cookie
              .split("; ")
              .find((row) => row.startsWith("user-session-data="));

            // Also check for user-profile cookie (this one is successfully set by login action)
            const userProfileCookie = document.cookie
              .split("; ")
              .find((row) => row.startsWith("user-profile-"));

            let cookieData = tempSessionCookie || sessionCookie;

            // FALLBACK: If no session cookies, extract data from user-profile cookie
            if (!cookieData && userProfileCookie) {
              try {
                const [cookieName, cookieValue] = userProfileCookie.split("=");
                if (!cookieValue || !cookieName) {
                  throw new Error("Invalid cookie format");
                }

                const profileData = JSON.parse(decodeURIComponent(cookieValue));
                // Extract user ID from cookie name (format: user-profile-{userId})
                const userId = cookieName.replace("user-profile-", "");

                // Create a session-like object from profile data
                const sessionData = {
                  userId: userId,
                  email: profileData.email,
                  userRole: profileData.type,
                  timestamp: profileData.timestamp,
                };

                // Create a minimal user object from profile cookie to prevent UI flash
                const minimalUser = {
                  id: userId,
                  email: profileData.email,
                  app_metadata: {},
                  user_metadata: {},
                  aud: "authenticated",
                  created_at: new Date().toISOString(),
                } as User;

                // Set basic user info immediately from profile cookie
                setUser(minimalUser);
                setUserRole(profileData.type);
                setHasImmediateData(true);

                // Skip the normal cookie processing since we handled it
                return;
              } catch (e) {
                // Failed to parse user-profile cookie
              }
            }

            if (cookieData) {
              const cookieParts = cookieData.split("=");
              if (!cookieParts[1]) {
                throw new Error("Invalid cookie format");
              }

              const sessionData = JSON.parse(
                decodeURIComponent(cookieParts[1]),
              );

              if (sessionData?.userId && sessionData?.userRole) {
                // Create a minimal user object from cookie to prevent UI flash
                // This will be replaced with full user data from Supabase
                const minimalUser = {
                  id: sessionData.userId,
                  email: sessionData.email,
                  app_metadata: {},
                  user_metadata: {},
                  aud: "authenticated",
                  created_at: new Date().toISOString(),
                } as User;

                // Set basic user info immediately from cookie
                // This prevents the "Sign In/Sign Up" flash
                setUser(minimalUser);
                setUserRole(sessionData.userRole);
                setHasImmediateData(true);

                // Clean up temp cookie if it exists
                if (tempSessionCookie) {
                  document.cookie =
                    "temp-session-data=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                }
              }
            }
          } catch (cookieError) {
            // Continue with normal flow
          }
        }

        // Get or create supabase client
        let client = supabase;
        if (!client) {
          const { createClient } = await import("@/utils/supabase/client");
          client = await createClient();
        }

        const {
          data: { session },
          error: sessionError,
        } = await client.auth.getSession();

        if (session?.user) {

          // Get user role from profile
          const { data: profile } = await client
            .from("profiles")
            .select("type")
            .eq("id", session.user.id)
            .single();

          if (profile?.type) {
            const userRole = profile.type.toLowerCase() as UserType;

            if (mounted) {
              setUser(session.user);
              setUserRole(userRole);
              setSession(session);
              setHasImmediateData(true);
              setIsLoading(false);
            }
            return;
          }
        }

        // No session found - retry up to 3 times with increasing delays
        // This handles the race condition after login redirect where cookies are still being set
        if (retryCount < 3) {
          const delay = (retryCount + 1) * 200; // 200ms, 400ms, 600ms
          retryTimeout = setTimeout(() => {
            if (mounted) {
              checkSupabaseSession(retryCount + 1);
            }
          }, delay);
          return;
        }

        // After all retries, no session found
        if (mounted) {
          setIsLoading(false);
        }
      } catch (error) {
        // On error, retry if we haven't exhausted attempts
        if (retryCount < 3 && mounted) {
          const delay = (retryCount + 1) * 200;
          retryTimeout = setTimeout(() => {
            if (mounted) {
              checkSupabaseSession(retryCount + 1);
            }
          }, delay);
        } else if (mounted) {
          setIsLoading(false);
        }
      }
    };

    checkSupabaseSession();

    return () => {
      mounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [supabase]);

  // Enhanced auth state management
  useEffect(() => {
    if (!supabase || !sessionManager) {
      return;
    }

    let mounted = true;
    let authListener: any = null;

    const setupAuth = async () => {
      let authTimeout: NodeJS.Timeout | null = null;

      try {
        // First, quickly check if there's any session data available
        const { data: sessionData } = await supabase.auth.getSession();

        // If no session exists, immediately set loading to false - no need to authenticate
        if (!sessionData?.session) {
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

        if (getUserError) {
          clearTimeout(authTimeout);

          // Handle "Auth session missing" error - this is expected for non-authenticated users
          if (getUserError.message?.includes("Auth session missing")) {

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
              // Error initializing enhanced session
            }

            // Only fetch role from DB if hydrated data doesn't match current user ID
            const recoveredState = recoverAuthState();
            if (!recoveredState || recoveredState.userId !== currentUser.id) {
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
              // Error initializing enhanced session
            }

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
                // Error initializing enhanced session on sign-in
              }
            }

            // Clear immediate data flag on auth state changes
            if (
              event === "SIGNED_IN" ||
              event === "SIGNED_OUT" ||
              event === "TOKEN_REFRESHED"
            ) {
              if (newUser?.id !== currentUser?.id) {
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
                  sessionExpiresAt: session?.expires_at
                    ? session.expires_at * 1000
                    : null,
                }));
              } else if (event === "TOKEN_REFRESHED" && session) {
                // Same user, just update session expiry and activity
                setAuthState((prev) => ({
                  ...prev,
                  lastActivity: Date.now(),
                  sessionExpiresAt: session.expires_at
                    ? session.expires_at * 1000
                    : null,
                }));
              }
            }
          },
        );

        authListener = listener;
      } catch (error) {
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
      setError("Failed to refresh user data. Please try again.");

      // Try to recover from persisted state as last resort
      try {
        const persistedState = getPersistedAuthState();
        if (persistedState) {
          const mockUser = {
            id: persistedState.userId,
            email: persistedState.email,
          } as User;

          setUser(mockUser);
          setUserRole(persistedState.userRole as UserType);
          setError(null); // Clear error if recovery succeeds

          // Update auth state
          setAuthState((prev) => ({
            ...prev,
            user: mockUser,
            userRole: persistedState.userRole as UserType,
            error: null,
          }));
        }
      } catch (recoveryError) {
        // Failed to recover from persisted state
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
    if (!sessionManager || !supabase) return;

    setAuthProgressState({
      step: "authenticating",
      message: "Refreshing authentication token...",
    });

    try {
      await sessionManager.refreshToken();
    } catch (error) {
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
    } catch (error) {
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

  // Allow hydration to proceed even when not isHydrated initially
  // The hydration useEffect will set isHydrated to true after checking for session data

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
        // You can add error reporting service here
        // e.g., Sentry, LogRocket, etc.
      }}
    >
      <UserProviderClient>{children}</UserProviderClient>
    </AuthErrorBoundary>
  );
}
