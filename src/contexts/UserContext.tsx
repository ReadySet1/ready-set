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

// Create the context with enhanced types
const UserContext = createContext<AuthContextType | null>(null);

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

  // Refs for cleanup and tracking
  const mountedRef = useRef(true);
  const authListenerRef = useRef<any>(null);
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

  // Enhanced user role fetching with retry logic
  const fetchUserRoleWithRetry = useCallback(
    async (supabase: any, user: User): Promise<UserType | null> => {
      const startTime = Date.now();

      try {
        console.log(`[UserContext] Fetching user role for user: ${user.id}`);

        const role = await retryWithBackoff(async () => {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("type")
            .eq("id", user.id)
            .single();

          if (error) {
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
    [retryWithBackoff, createAuthError],
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

        // Get initial session and user data with validation
        let initialSession = null;
        let currentUser = null;
        let getUserError = null;
        try {
          const sessionResult = await supabase.auth.getSession();
          initialSession = sessionResult.data.session;
        } catch (err) {
          if (err?.name === "AuthSessionMissingError") {
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
          if (err?.name === "AuthSessionMissingError") {
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

          // Fetch user role with loading state
          setProfileState((prev) => ({ ...prev, isLoading: true }));
          const role = await fetchUserRoleWithRetry(supabase, currentUser);

          if (role) {
            setUserRole(role);
          }

          setProfileState((prev) => ({ ...prev, isLoading: false }));
        } else {
          console.log(
            "[UserContext] No authenticated user found or session invalid",
          );
          // Explicitly set user to null when no authentication
          setUser(null);
          setUserRole(null);
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
              return;
            }

            // Only fetch role if user changed or we don't have a role yet
            if (newUser?.id !== currentUser?.id || !userRole) {
              console.log("[UserContext] Fetching role for new/changed user");
              setProfileState((prev) => ({ ...prev, isLoading: true }));
              const role = await fetchUserRoleWithRetry(supabase, newUser);
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
        }
      }
    };

    setupAuth();

    return () => {
      mountedRef.current = false;
      if (authListenerRef.current) {
        authListenerRef.current.subscription.unsubscribe();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [
    fetchUserRoleWithRetry,
    validateSession,
    createAuthError,
    authState.retryCount,
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
        const role = await fetchUserRoleWithRetry(supabase, currentUser);
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
  }, [fetchUserRoleWithRetry, createAuthError]);

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
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
}

// Export the provider component
export function UserProvider({ children }: { children: ReactNode }) {
  return <UserProviderClient>{children}</UserProviderClient>;
}
