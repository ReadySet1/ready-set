// src/contexts/UserContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { createClient } from "@/utils/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { UserType } from "@/types/user";
import {
  AuthErrorType,
  AuthError,
  AuthState,
  ProfileState,
  AuthContextType,
  AuthMetrics,
} from "@/types/auth";
import {
  getDashboardRouteByRole,
  getOrderDetailPath as getOrderDetailPathUtil,
} from "@/utils/navigation";
import {
  emitAuthEvent,
  onAuthEvent,
  getPendingAuthState,
  clearPendingAuthState,
  confirmAuthenticationState,
  requestAuthSync,
} from "@/utils/auth-events";

// Create the context with enhanced types
export const UserContext = createContext<AuthContextType | null>(null);

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
  // Core auth state
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserType | null>(null);
  const [error, setError] = useState<AuthError | null>(null);

  // Enhanced state tracking
  const [authState, setAuthState] = useState<AuthState>({
    isInitialized: false,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    retryCount: 0,
    lastAuthCheck: null,
  });

  const [profileState, setProfileState] = useState<ProfileState>({
    data: null,
    isLoading: false,
    error: null,
    lastFetched: null,
    retryCount: 0,
  });

  // Performance tracking
  const [authMetrics, setAuthMetrics] = useState<AuthMetrics>({
    authInitTime: 0,
    profileFetchTime: 0,
    sessionValidationTime: 0,
    errorCount: 0,
    retryCount: 0,
    lastSuccessfulAuth: null,
  });

  // NEW: Role caching mechanism to prevent race conditions
  const [roleCache, setRoleCache] = useState<
    Map<string, { role: UserType; timestamp: number }>
  >(new Map());
  const roleCacheTimeout = 5 * 60 * 1000; // 5 minutes

  // Refs for cleanup and tracking
  const mountedRef = useRef(true);
  const authListenerRef = useRef<any>(null);
  const authEventListenerRef = useRef<any>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced error creation utility
  const createAuthError = useCallback(
    (
      type: AuthErrorType,
      message: string,
      retryable: boolean = true,
      details?: any,
    ): AuthError => {
      return {
        type,
        message,
        retryable,
        timestamp: new Date(),
        details,
      };
    },
    [],
  );

  // NEW: Enhanced role caching utility
  const getCachedRole = useCallback(
    (userId: string): UserType | null => {
      const cached = roleCache.get(userId);
      if (cached && Date.now() - cached.timestamp < roleCacheTimeout) {
        console.log(
          `[UserContext] Using cached role for user ${userId}: ${cached.role}`,
        );
        return cached.role;
      }
      return null;
    },
    [roleCache, roleCacheTimeout],
  );

  const setCachedRole = useCallback((userId: string, role: UserType) => {
    setRoleCache((prev) =>
      new Map(prev).set(userId, { role, timestamp: Date.now() }),
    );
    console.log(`[UserContext] Cached role for user ${userId}: ${role}`);
  }, []);

  const clearRoleCache = useCallback((userId?: string) => {
    if (userId) {
      setRoleCache((prev) => {
        const newCache = new Map(prev);
        newCache.delete(userId);
        return newCache;
      });
      console.log(`[UserContext] Cleared cached role for user ${userId}`);
    } else {
      setRoleCache(new Map());
      console.log("[UserContext] Cleared all role cache");
    }
  }, []);

  // Enhanced retry logic with exponential backoff
  const retryWithBackoff = useCallback(
    async (
      operation: () => Promise<any>,
      maxRetries: number = 3,
      baseDelay: number = 1000,
    ): Promise<any> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[UserContext] Retry attempt ${attempt}/${maxRetries}`);
          const result = await operation();

          // Update metrics on success
          setAuthMetrics((prev) => ({
            ...prev,
            retryCount: prev.retryCount + 1,
            lastSuccessfulAuth: new Date(),
          }));

          return result;
        } catch (err) {
          console.warn(`[UserContext] Retry attempt ${attempt} failed:`, err);

          if (attempt === maxRetries) {
            throw err;
          }

          // Exponential backoff
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    },
    [],
  );

  // Enhanced user role fetching with retry logic and caching
  const fetchUserRoleWithRetry = useCallback(
    async (supabase: any, user: User): Promise<UserType | null> => {
      const startTime = Date.now();

      try {
        console.log(`[UserContext] Fetching user role for user: ${user.id}`);

        // NEW: Check cache first
        const cachedRole = getCachedRole(user.id);
        if (cachedRole) {
          const duration = Date.now() - startTime;
          setAuthMetrics((prev) => ({
            ...prev,
            profileFetchTime: duration,
          }));
          return cachedRole;
        }

        const role = await retryWithBackoff(async () => {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("type")
            .eq("id", user.id)
            .single();

          if (error) {
            // If profile doesn't exist, create one
            if (error.code === "PGRST116") {
              // No rows returned
              console.log(
                `[UserContext] No profile found for user ${user.id}, creating one...`,
              );

              // Helper function to determine if user should be admin
              const shouldBeAdmin = (email: string): boolean => {
                const adminEmail =
                  process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase();
                const adminEmails =
                  process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) =>
                    e.trim().toLowerCase(),
                  ) || [];
                const adminDomains =
                  process.env.NEXT_PUBLIC_ADMIN_DOMAINS?.split(",").map((d) =>
                    d.trim().toLowerCase(),
                  ) || [];

                const emailLower = email.toLowerCase();

                // Check exact email match (including existing ADMIN_EMAIL)
                if (adminEmail && emailLower === adminEmail) {
                  return true;
                }

                // Check exact email match
                if (adminEmails.includes(emailLower)) {
                  return true;
                }

                // Check domain match
                const domain = emailLower.split("@")[1];
                if (domain && adminDomains.includes(domain)) {
                  return true;
                }

                return false;
              };

              // Create profile for new user
              const email = user.email;
              const name =
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                email?.split("@")[0] ||
                "User";
              const image =
                user.user_metadata?.avatar_url || user.user_metadata?.picture;

              // Determine user type
              let type = "client";
              if (email && shouldBeAdmin(email)) {
                type = "admin";
              }

              console.log(
                `[UserContext] Creating profile for user ${user.id} with type: ${type}`,
              );

              const { data: newProfile, error: createError } = await supabase
                .from("profiles")
                .insert({
                  id: user.id,
                  email: email,
                  name: name,
                  image: image,
                  type: type,
                  status: "active",
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .select("type")
                .single();

              if (createError) {
                console.error(
                  "[UserContext] Error creating profile:",
                  createError,
                );
                throw createError;
              }

              console.log(
                "[UserContext] Profile created successfully:",
                newProfile,
              );
              return newProfile.type;
            }
            throw error;
          }

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
        });

        const duration = Date.now() - startTime;
        setAuthMetrics((prev) => ({
          ...prev,
          profileFetchTime: duration,
        }));

        // NEW: Cache the role
        setCachedRole(user.id, role);

        console.log(`[UserContext] User role fetched successfully: ${role}`);
        return role;
      } catch (err) {
        console.error("[UserContext] Failed to fetch user role:", err);

        const authError = createAuthError(
          AuthErrorType.ROLE_FETCH_FAILED,
          "Failed to fetch user role",
          true,
          err,
        );

        setError(authError);
        setAuthMetrics((prev) => ({
          ...prev,
          errorCount: prev.errorCount + 1,
        }));

        return null;
      }
    },
    [retryWithBackoff, createAuthError, getCachedRole, setCachedRole],
  );

  // NEW: Enhanced OAuth-specific role fetching with immediate retry
  const fetchUserRoleForOAuth = useCallback(
    async (supabase: any, user: User): Promise<UserType | null> => {
      console.log(
        `[UserContext] Fetching user role for OAuth user: ${user.id}`,
      );

      // Clear any cached role for this user to ensure fresh data
      clearRoleCache(user.id);

      // Add extra delay for OAuth users to ensure profile is created
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try multiple times with increasing delays
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          console.log(`[UserContext] OAuth role fetch attempt ${attempt}/5`);

          const role = await fetchUserRoleWithRetry(supabase, user);
          if (role) {
            console.log(
              `[UserContext] OAuth role fetch successful on attempt ${attempt}: ${role}`,
            );
            return role;
          }

          // Wait before next attempt
          if (attempt < 5) {
            const delay = 1000 * attempt; // 1s, 2s, 3s, 4s
            console.log(
              `[UserContext] Waiting ${delay}ms before OAuth role fetch retry...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        } catch (error) {
          console.warn(
            `[UserContext] OAuth role fetch attempt ${attempt} failed:`,
            error,
          );

          if (attempt < 5) {
            const delay = 1000 * attempt;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      console.error("[UserContext] All OAuth role fetch attempts failed");
      return null;
    },
    [fetchUserRoleWithRetry, clearRoleCache],
  );

  // Enhanced session validation
  const validateSession = useCallback(
    async (supabase: any): Promise<boolean> => {
      const startTime = Date.now();

      try {
        console.log("[UserContext] Validating session");

        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        const duration = Date.now() - startTime;
        setAuthMetrics((prev) => ({
          ...prev,
          sessionValidationTime: duration,
        }));

        return !!currentSession;
      } catch (err) {
        console.error("[UserContext] Session validation failed:", err);
        return false;
      }
    },
    [],
  );

  // NEW: Enhanced authentication state refresh with retry mechanisms and OAuth handling
  const forceAuthRefresh = useCallback(
    async (reason: string = "manual", maxRetries: number = 3) => {
      console.log(`[UserContext] Force auth refresh triggered: ${reason}`);

      let attempt = 0;
      while (attempt < maxRetries) {
        try {
          attempt++;
          console.log(
            `[UserContext] Auth refresh attempt ${attempt}/${maxRetries}`,
          );

          setAuthState((prev) => ({
            ...prev,
            isLoading: true,
            error: null,
          }));

          const supabase = supabaseClient;

          // Force fresh session fetch with retry logic
          let freshSession = null;
          let freshUser = null;

          try {
            const sessionResult = await supabase.auth.getSession();
            freshSession = sessionResult.data.session;

            const userResult = await supabase.auth.getUser();
            freshUser = userResult.data.user;

            // Validate that we have consistent data
            if (freshSession && !freshUser) {
              throw new Error(
                "Session exists but user is null - inconsistent state",
              );
            }

            if (!freshSession && freshUser) {
              throw new Error(
                "User exists but session is null - inconsistent state",
              );
            }
          } catch (authError: any) {
            if (
              attempt < maxRetries &&
              (authError.message?.includes("timeout") ||
                authError.message?.includes("network") ||
                authError.message?.includes("inconsistent"))
            ) {
              console.warn(
                `[UserContext] Auth refresh attempt ${attempt} failed, retrying:`,
                authError,
              );
              await new Promise((resolve) =>
                setTimeout(resolve, Math.pow(2, attempt) * 1000),
              ); // Exponential backoff
              continue;
            }
            throw authError;
          }

          console.log("[UserContext] Fresh auth data retrieved:", {
            hasSession: !!freshSession,
            hasUser: !!freshUser,
            userId: freshUser?.id,
            attempt,
          });

          // Update session and user immediately
          setSession(freshSession);
          setUser(freshUser);

          if (freshUser && freshSession) {
            // NEW: Check if this is an OAuth user and handle accordingly
            const isOAuthUser =
              freshUser.app_metadata?.provider === "google" ||
              freshUser.app_metadata?.provider === "github" ||
              freshUser.app_metadata?.provider === "facebook";

            let role: UserType | null = null;

            if (isOAuthUser) {
              console.log(
                `[UserContext] OAuth user detected (${freshUser.app_metadata?.provider}), using OAuth-specific role fetch`,
              );
              role = await fetchUserRoleForOAuth(supabase, freshUser);
            } else {
              // Fetch user role with retry
              role = await fetchUserRoleWithRetry(supabase, freshUser);
            }

            if (role) {
              setUserRole(role);
            }

            setAuthState((prev) => ({
              ...prev,
              isAuthenticated: true,
              isLoading: false,
              lastAuthCheck: new Date(),
              retryCount: 0, // Reset retry count on success
            }));

            // Persist successful authentication state
            if (typeof window !== "undefined") {
              const authStateToStore = {
                isAuthenticated: true,
                userId: freshUser.id,
                email: freshUser.email,
                timestamp: Date.now(),
              };
              localStorage.setItem(
                "ready-set-auth-state",
                JSON.stringify(authStateToStore),
              );
            }

            // Emit login event for immediate UI updates
            emitAuthEvent(
              "login",
              { user: freshUser, session: freshSession },
              "client",
            );

            console.log(
              "[UserContext] Authentication state refreshed successfully",
            );
            break; // Success - exit retry loop
          } else {
            // No authentication found
            setUserRole(null);
            setAuthState((prev) => ({
              ...prev,
              isAuthenticated: false,
              isLoading: false,
              lastAuthCheck: new Date(),
              retryCount: 0,
            }));

            // Clear any persisted state
            if (typeof window !== "undefined") {
              localStorage.removeItem("ready-set-auth-state");
            }
            break; // No auth found - exit retry loop
          }

          // Clear any pending auth state
          clearPendingAuthState();
        } catch (error) {
          console.error(
            `[UserContext] Auth refresh attempt ${attempt} failed:`,
            error,
          );

          if (attempt >= maxRetries) {
            console.error("[UserContext] All auth refresh attempts failed");
            setError(
              createAuthError(
                AuthErrorType.UNKNOWN_ERROR,
                `Failed to refresh authentication state after ${maxRetries} attempts`,
                true,
                error,
              ),
            );
            setAuthState((prev) => ({
              ...prev,
              isLoading: false,
              retryCount: prev.retryCount + 1,
              error: createAuthError(
                AuthErrorType.UNKNOWN_ERROR,
                `Failed to refresh authentication state after ${maxRetries} attempts`,
                true,
                error,
              ),
            }));

            // On final failure, emit a retry request after delay
            setTimeout(() => {
              console.log(
                "[UserContext] Requesting fallback auth sync after failure",
              );
              requestAuthSync("fallback after refresh failure");
            }, 5000);
          }
        }
      }
    },
    [fetchUserRoleWithRetry, fetchUserRoleForOAuth, createAuthError],
  );

  // NEW: Enhanced authentication events handling with OAuth-specific logic
  useEffect(() => {
    console.log("[UserContext] Setting up authentication event listener");

    const unsubscribe = onAuthEvent(async (event) => {
      const { type, payload, source } = event.detail;
      console.log(`[UserContext] Received auth event: ${type}`, {
        payload,
        source,
      });

      switch (type) {
        case "auth-sync-requested":
          await forceAuthRefresh(`event: ${type}`);
          break;

        case "auth-state-check":
          if (payload?.confirmed && payload?.user) {
            console.log(
              "[UserContext] Auth state confirmed via event, validating...",
            );

            // Validate the confirmed state before updating
            try {
              const supabase = supabaseClient;
              const {
                data: { session: currentSession },
                error,
              } = await supabase.auth.getSession();

              if (error) {
                console.warn(
                  "[UserContext] Session validation failed during state check:",
                  error,
                );
                // Request fresh auth sync instead of using potentially stale data
                await forceAuthRefresh("validation failed during state check");
                return;
              }

              // Only update if we have a valid session that matches the payload
              if (currentSession?.user?.id === payload.user.id) {
                console.log(
                  "[UserContext] State validation passed, updating context",
                );
                setUser(payload.user);
                setSession(payload.session);
                setAuthState((prev) => ({
                  ...prev,
                  isAuthenticated: true,
                  isLoading: false,
                  lastAuthCheck: new Date(),
                }));

                // Persist validated state
                if (typeof window !== "undefined") {
                  const authStateToStore = {
                    isAuthenticated: true,
                    userId: payload.user.id,
                    email: payload.user.email,
                    timestamp: Date.now(),
                  };
                  localStorage.setItem(
                    "ready-set-auth-state",
                    JSON.stringify(authStateToStore),
                  );
                }
              } else {
                console.warn(
                  "[UserContext] State validation failed - session mismatch, requesting fresh sync",
                );
                await forceAuthRefresh("session mismatch during validation");
              }
            } catch (validationError) {
              console.error(
                "[UserContext] Error during state validation:",
                validationError,
              );
              await forceAuthRefresh("error during state validation");
            }
          }
          break;

        case "session-refresh":
          console.log("[UserContext] Session refresh requested");
          await forceAuthRefresh("session refresh request");
          break;

        case "session-expired":
          console.log("[UserContext] Session expired, clearing state");
          setUser(null);
          setSession(null);
          setUserRole(null);
          setAuthState((prev) => ({
            ...prev,
            isAuthenticated: false,
            isLoading: false,
            lastAuthCheck: new Date(),
          }));

          if (typeof window !== "undefined") {
            localStorage.removeItem("ready-set-auth-state");
            sessionStorage.removeItem("ready-set-auth-pending");
          }

          // Clear role cache on session expiry
          clearRoleCache();
          break;

        default:
          // Handle other auth events as needed
          break;
      }
    });

    authEventListenerRef.current = unsubscribe;

    return () => {
      if (authEventListenerRef.current) {
        authEventListenerRef.current();
      }
    };
  }, [forceAuthRefresh, clearRoleCache]);

  // NEW: Check for pending authentication state on mount
  useEffect(() => {
    const checkPendingAuth = async () => {
      const pendingAuth = getPendingAuthState();
      if (pendingAuth) {
        console.log(
          "[UserContext] Found pending auth state, confirming...",
          pendingAuth,
        );

        // Small delay to ensure any redirects have completed
        setTimeout(async () => {
          const confirmed = await confirmAuthenticationState();
          if (confirmed) {
            await forceAuthRefresh("pending auth confirmation");
          }
          clearPendingAuthState();
        }, 100);
      }
    };

    checkPendingAuth();
  }, [forceAuthRefresh]);

  // Enhanced auth state setup with improved error handling and session persistence
  useEffect(() => {
    const setupAuth = async () => {
      const startTime = Date.now();

      try {
        console.log("[UserContext] Starting enhanced authentication setup");
        const supabase = supabaseClient;

        // Update auth state to loading
        setAuthState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        // NEW: Check for persisted authentication state
        const persistedAuthState =
          typeof window !== "undefined"
            ? localStorage.getItem("ready-set-auth-state")
            : null;

        if (persistedAuthState) {
          try {
            const parsed = JSON.parse(persistedAuthState);
            console.log("[UserContext] Found persisted auth state:", parsed);

            // Use persisted state as initial optimistic state
            if (
              parsed.isAuthenticated &&
              parsed.timestamp &&
              Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000
            ) {
              // 24 hours
              console.log(
                "[UserContext] Using persisted auth state for faster initial load",
              );
              setAuthState((prev) => ({
                ...prev,
                isAuthenticated: true,
                isLoading: true, // Keep loading to verify
              }));
            }
          } catch (error) {
            console.warn(
              "[UserContext] Error parsing persisted auth state:",
              error,
            );
            localStorage.removeItem("ready-set-auth-state");
          }
        }

        // Get initial session and user data with validation
        let initialSession = null;
        let currentUser = null;
        let getUserError = null;
        try {
          const sessionResult = await supabase.auth.getSession();
          initialSession = sessionResult.data.session;
        } catch (err) {
          if ((err as any)?.name === "AuthSessionMissingError") {
            initialSession = null;
          } else {
            throw err;
          }
        }
        try {
          const userResult = await supabase.auth.getUser();
          currentUser = userResult.data.user;
          getUserError = userResult.error;
        } catch (err) {
          if ((err as any)?.name === "AuthSessionMissingError") {
            currentUser = null;
            getUserError = null;
          } else {
            throw err;
          }
        }

        if (!mountedRef.current) return;

        if (getUserError) {
          console.error("[UserContext] Error getting user:", getUserError);
          // Patch: treat as logged out if AuthSessionMissingError
          if (getUserError.name === "AuthSessionMissingError") {
            setUser(null);
            setUserRole(null);
            setSession(null);
            setAuthState({
              isInitialized: true,
              isAuthenticated: false,
              isLoading: false,
              error: null,
              retryCount: authState.retryCount + 1,
              lastAuthCheck: new Date(),
            });

            // Clear persisted state
            if (typeof window !== "undefined") {
              localStorage.removeItem("ready-set-auth-state");
            }
            return;
          }
          throw getUserError;
        }

        // Validate session
        const isSessionValid = await validateSession(supabase);

        console.log("[UserContext] Initial auth state:", {
          hasSession: !!initialSession,
          hasUser: !!currentUser,
          isSessionValid,
          userId: currentUser?.id,
        });

        // Set session first
        setSession(initialSession);

        if (currentUser && isSessionValid) {
          console.log("[UserContext] Setting authenticated user");
          setUser(currentUser);

          // NEW: Check if this is an OAuth user
          const isOAuthUser =
            currentUser.app_metadata?.provider === "google" ||
            currentUser.app_metadata?.provider === "github" ||
            currentUser.app_metadata?.provider === "facebook";

          // Fetch user role with loading state
          setProfileState((prev) => ({ ...prev, isLoading: true }));

          let role: UserType | null = null;
          if (isOAuthUser) {
            console.log(
              `[UserContext] OAuth user detected (${currentUser.app_metadata?.provider}), using OAuth-specific role fetch`,
            );
            role = await fetchUserRoleForOAuth(supabase, currentUser);
          } else {
            role = await fetchUserRoleWithRetry(supabase, currentUser);
          }

          if (role) {
            setUserRole(role);
          }

          setProfileState((prev) => ({ ...prev, isLoading: false }));

          // NEW: Persist authentication state
          if (typeof window !== "undefined") {
            const authStateToStore = {
              isAuthenticated: true,
              userId: currentUser.id,
              email: currentUser.email,
              timestamp: Date.now(),
            };
            localStorage.setItem(
              "ready-set-auth-state",
              JSON.stringify(authStateToStore),
            );
            console.log("[UserContext] Persisted authentication state");
          }
        } else {
          console.log(
            "[UserContext] No authenticated user found or session invalid",
          );
          // Explicitly set user to null when no authentication
          setUser(null);
          setUserRole(null);

          // Clear persisted state
          if (typeof window !== "undefined") {
            localStorage.removeItem("ready-set-auth-state");
          }
        }

        // Mark auth as initialized and set loading to false
        const duration = Date.now() - startTime;
        setAuthState({
          isInitialized: true,
          isAuthenticated: !!currentUser && isSessionValid,
          isLoading: false,
          error: null,
          retryCount: 0,
          lastAuthCheck: new Date(),
        });

        setAuthMetrics((prev) => ({
          ...prev,
          authInitTime: duration,
        }));

        console.log("[UserContext] Enhanced authentication setup completed");

        // Set up auth state change listener with enhanced error handling
        const { data: listener } = supabase.auth.onAuthStateChange(
          async (event: string, session: Session | null) => {
            if (!mountedRef.current) return;

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
              setAuthState((prev) => ({
                ...prev,
                isAuthenticated: false,
                isLoading: false,
              }));

              // Clear persisted state on logout
              if (typeof window !== "undefined") {
                localStorage.removeItem("ready-set-auth-state");
                sessionStorage.removeItem("ready-set-auth-pending");
              }

              // Clear role cache on logout
              clearRoleCache();

              emitAuthEvent("logout", null, "listener");
              return;
            }

            // Only fetch role if user changed or we don't have a role yet
            if (newUser?.id !== currentUser?.id || !userRole) {
              console.log("[UserContext] Fetching role for new/changed user");
              setProfileState((prev) => ({ ...prev, isLoading: true }));

              // NEW: Check if this is an OAuth user
              const isOAuthUser =
                newUser.app_metadata?.provider === "google" ||
                newUser.app_metadata?.provider === "github" ||
                newUser.app_metadata?.provider === "facebook";

              let role: UserType | null = null;
              if (isOAuthUser) {
                console.log(
                  `[UserContext] OAuth user detected (${newUser.app_metadata?.provider}), using OAuth-specific role fetch`,
                );
                role = await fetchUserRoleForOAuth(supabase, newUser);
              } else {
                role = await fetchUserRoleWithRetry(supabase, newUser);
              }

              if (role) {
                setUserRole(role);
              }
              setProfileState((prev) => ({ ...prev, isLoading: false }));
            }

            setAuthState((prev) => ({
              ...prev,
              isAuthenticated: true,
              isLoading: false,
              lastAuthCheck: new Date(),
            }));

            // NEW: Persist authentication state on successful login
            if (typeof window !== "undefined") {
              const authStateToStore = {
                isAuthenticated: true,
                userId: newUser.id,
                email: newUser.email,
                timestamp: Date.now(),
              };
              localStorage.setItem(
                "ready-set-auth-state",
                JSON.stringify(authStateToStore),
              );
              console.log(
                "[UserContext] Persisted authentication state after login",
              );
            }

            emitAuthEvent("login", { user: newUser }, "listener");
          },
        );

        authListenerRef.current = listener;
      } catch (error) {
        console.error(
          "[UserContext] Enhanced authentication setup failed:",
          error,
        );

        if (mountedRef.current) {
          const authError = createAuthError(
            AuthErrorType.INITIALIZATION_FAILED,
            "Authentication setup failed",
            true,
            error,
          );

          setError(authError);
          setAuthState({
            isInitialized: true,
            isAuthenticated: false,
            isLoading: false,
            error: authError,
            retryCount: authState.retryCount + 1,
            lastAuthCheck: new Date(),
          });

          setAuthMetrics((prev) => ({
            ...prev,
            errorCount: prev.errorCount + 1,
          }));

          // Clear persisted state on initialization failure
          if (typeof window !== "undefined") {
            localStorage.removeItem("ready-set-auth-state");
          }
        }
      }
    };

    setupAuth();

    return () => {
      mountedRef.current = false;
      if (authListenerRef.current) {
        authListenerRef.current.subscription.unsubscribe();
      }
      if (authEventListenerRef.current) {
        authEventListenerRef.current();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [
    fetchUserRoleWithRetry,
    fetchUserRoleForOAuth,
    validateSession,
    createAuthError,
    authState.retryCount,
    forceAuthRefresh,
    clearRoleCache,
  ]);

  // Enhanced refresh user data with retry logic
  const refreshUserData = useCallback(async () => {
    try {
      console.log("[UserContext] Refreshing user data");
      const supabase = supabaseClient;

      setAuthState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      const {
        data: { user: currentUser },
        error: getUserError,
      } = await supabase.auth.getUser();

      if (getUserError) {
        throw getUserError;
      }

      setUser(currentUser);

      if (currentUser) {
        // NEW: Check if this is an OAuth user
        const isOAuthUser =
          currentUser.app_metadata?.provider === "google" ||
          currentUser.app_metadata?.provider === "github" ||
          currentUser.app_metadata?.provider === "facebook";

        let role: UserType | null = null;
        if (isOAuthUser) {
          console.log(
            `[UserContext] OAuth user detected (${currentUser.app_metadata?.provider}), using OAuth-specific role fetch`,
          );
          role = await fetchUserRoleForOAuth(supabase, currentUser);
        } else {
          role = await fetchUserRoleWithRetry(supabase, currentUser);
        }

        if (role) {
          setUserRole(role);
        }
      } else {
        setUserRole(null);
      }

      setAuthState((prev) => ({
        ...prev,
        isAuthenticated: !!currentUser,
        isLoading: false,
        lastAuthCheck: new Date(),
      }));

      console.log("[UserContext] User data refreshed successfully");
    } catch (err) {
      console.error("[UserContext] Error refreshing user data:", err);

      const authError = createAuthError(
        AuthErrorType.UNKNOWN_ERROR,
        "Failed to refresh user data",
        true,
        err,
      );

      setError(authError);
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: authError,
      }));
    }
  }, [fetchUserRoleWithRetry, fetchUserRoleForOAuth, createAuthError]);

  // Enhanced retry auth method
  const retryAuth = useCallback(async () => {
    console.log("[UserContext] Retrying authentication");

    setAuthState((prev) => ({
      ...prev,
      retryCount: prev.retryCount + 1,
      error: null,
    }));

    await refreshUserData();
  }, [refreshUserData]);

  // Clear error method
  const clearError = useCallback(() => {
    setError(null);
    setAuthState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  // Navigation helpers
  const getDashboardPath = () => {
    if (!userRole) return "/";
    return getDashboardRouteByRole(userRole).path;
  };

  const getOrderDetailPath = (orderNumber: string) => {
    if (!userRole) return "/";
    return getOrderDetailPathUtil(orderNumber, userRole);
  };

  // --- Add signOut method ---
  const signOut = useCallback(async () => {
    try {
      await supabaseClient.auth.signOut();
      setUser(null);
      setSession(null);
      setUserRole(null);
      setAuthState((prev) => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
        lastAuthCheck: new Date(),
      }));
      await refreshUserData();
      emitAuthEvent("logout", null, "client");
    } catch (error) {
      console.error("[UserContext] Error signing out:", error);
      setError(
        createAuthError(
          AuthErrorType.UNKNOWN_ERROR,
          "Failed to sign out",
          true,
          error,
        ),
      );
    }
  }, [refreshUserData, createAuthError]);

  // --- Enhanced signIn method with comprehensive post-login validation ---
  const signIn = useCallback(
    async (email: string, password: string) => {
      console.log("[UserContext] Enhanced sign in started for:", email);

      try {
        setAuthState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        console.log(
          "[UserContext] Initial sign in successful, validating state...",
        );

        // Post-login validation: Ensure we have consistent authentication state
        let validationRetries = 0;
        const maxValidationRetries = 3;
        let validationSuccessful = false;

        while (
          validationRetries < maxValidationRetries &&
          !validationSuccessful
        ) {
          try {
            validationRetries++;
            console.log(
              `[UserContext] Post-login validation attempt ${validationRetries}/${maxValidationRetries}`,
            );

            // Wait a moment for auth state to propagate
            if (validationRetries > 1) {
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * validationRetries),
              );
            }

            // Re-fetch to ensure we have the latest state
            const {
              data: { session: validationSession },
              error: sessionError,
            } = await supabaseClient.auth.getSession();
            const {
              data: { user: validationUser },
              error: userError,
            } = await supabaseClient.auth.getUser();

            if (sessionError || userError) {
              throw new Error(
                `Validation failed: ${sessionError?.message || userError?.message}`,
              );
            }

            // Validate that the authentication was successful and consistent
            if (!validationSession || !validationUser) {
              throw new Error(
                "Post-login validation failed: Missing session or user",
              );
            }

            if (validationSession.user.id !== validationUser.id) {
              throw new Error(
                "Post-login validation failed: Session and user ID mismatch",
              );
            }

            if (validationUser.email !== email) {
              throw new Error("Post-login validation failed: Email mismatch");
            }

            console.log("[UserContext] Post-login validation successful");

            // Update state with validated data
            setSession(validationSession);
            setUser(validationUser);
            setAuthState((prev) => ({
              ...prev,
              isAuthenticated: true,
              isLoading: false,
              lastAuthCheck: new Date(),
              retryCount: 0,
            }));

            // Fetch user role
            const role = await fetchUserRoleWithRetry(
              supabaseClient,
              validationUser,
            );
            if (role) {
              setUserRole(role);
            }

            // Persist validated authentication state
            if (typeof window !== "undefined") {
              const authStateToStore = {
                isAuthenticated: true,
                userId: validationUser.id,
                email: validationUser.email,
                timestamp: Date.now(),
              };
              localStorage.setItem(
                "ready-set-auth-state",
                JSON.stringify(authStateToStore),
              );
            }

            // Emit validated login event
            emitAuthEvent(
              "login",
              { user: validationUser, session: validationSession },
              "client",
            );

            validationSuccessful = true;
            console.log(
              "[UserContext] Enhanced sign in completed successfully",
            );
          } catch (validationError) {
            console.warn(
              `[UserContext] Post-login validation attempt ${validationRetries} failed:`,
              validationError,
            );

            if (validationRetries >= maxValidationRetries) {
              // Final validation attempt failed - still update state but with warnings
              console.error(
                "[UserContext] All post-login validation attempts failed, using initial auth data",
              );

              setSession(data.session);
              setUser(data.user);
              setAuthState((prev) => ({
                ...prev,
                isAuthenticated: !!data.user,
                isLoading: false,
                lastAuthCheck: new Date(),
                retryCount: prev.retryCount + 1,
              }));

              // Still try to refresh data and emit events
              await refreshUserData();
              emitAuthEvent("login", { user: data.user }, "client");

              // Request a background auth sync to fix any inconsistencies
              setTimeout(() => {
                requestAuthSync("post-login validation failed");
              }, 2000);

              validationSuccessful = true; // Exit retry loop
            }
          }
        }
      } catch (error) {
        console.error("[UserContext] Enhanced sign in failed:", error);

        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          retryCount: prev.retryCount + 1,
        }));

        setError(
          createAuthError(
            AuthErrorType.UNKNOWN_ERROR,
            "Failed to sign in",
            true,
            error,
          ),
        );

        // Clear any potentially stale persisted state
        if (typeof window !== "undefined") {
          localStorage.removeItem("ready-set-auth-state");
        }
      }
    },
    [refreshUserData, createAuthError, fetchUserRoleWithRetry],
  );

  // Enhanced loading state - only show loading if auth is not initialized
  const effectiveLoading = authState.isLoading || !authState.isInitialized;

  const contextValue: AuthContextType = {
    session,
    user,
    userRole,
    isLoading: effectiveLoading,
    error,
    authState,
    profileState,
    refreshUserData,
    retryAuth,
    clearError,
    getDashboardPath,
    getOrderDetailPath,
    signOut,
    signIn,
    // NEW: Add force refresh method to context
    forceAuthRefresh,
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
}

// Export the provider component
export function UserProvider({ children }: { children: ReactNode }) {
  return <UserProviderClient>{children}</UserProviderClient>;
}
