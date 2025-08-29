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
const UserContext = createContext<UserContextType>({
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

// Helper function to fetch user role
const fetchUserRole = async (
  supabase: any,
  user: User,
  setUserRole: (role: UserType) => void,
) => {
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

    setUserRole(role);
    return role;
  } catch (err) {
    console.error("Error fetching user role:", err);
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

  // Initialize Supabase
  useEffect(() => {
    const initSupabase = async () => {
      console.log("🔌 UserContext: Initializing Supabase client...");
      setAuthProgressState({
        step: "connecting",
        message: "Connecting to authentication service...",
      });

      try {
        const client = await createClient();
        console.log("✅ UserContext: Supabase client initialized successfully");
        setSupabase(client);
        setAuthProgressState({ step: "idle", message: "" });
      } catch (err) {
        console.error(
          "❌ UserContext: Failed to initialize Supabase client:",
          err,
        );
        setError("Authentication initialization failed");
        setIsLoading(false);
        setAuthProgressState({ step: "idle", message: "" });
      }
    };

    initSupabase();
  }, []);

  // Function to set auth progress with optional custom message
  const setAuthProgress = useCallback(
    (step: UserContextType["authProgress"]["step"], message?: string) => {
      const defaultMessages = {
        idle: "",
        connecting: "Connecting to authentication service...",
        authenticating: "Verifying credentials...",
        fetching_profile: "Loading user profile...",
        redirecting: "Redirecting to dashboard...",
        complete: "Authentication complete!",
      };

      setAuthProgressState({
        step,
        message: message || defaultMessages[step],
      });

      // Update isAuthenticating state based on progress
      setIsAuthenticating(step !== "idle" && step !== "complete");

      console.log(
        `🔄 UserContext: Auth progress - ${step}: ${message || defaultMessages[step]}`,
      );
    },
    [],
  );

  // Function to clear auth errors
  const clearAuthError = useCallback(() => {
    setError(null);
  }, []);

  // Load user data
  useEffect(() => {
    if (!supabase) {
      console.log("⏳ UserContext: Waiting for Supabase client...");
      return;
    }

    console.log("🔐 UserContext: Setting up auth state...");
    let mounted = true;
    let authListener: any = null;

    const setupAuth = async () => {
      try {
        console.log("👤 UserContext: Getting initial user data...");
        setAuthProgress("fetching_profile", "Checking current session...");

        const {
          data: { user: currentUser },
          error: getUserError,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (getUserError) {
          console.error("❌ UserContext: Error getting user:", getUserError);
          setError("Failed to retrieve user session");
          setIsLoading(false);
          setAuthProgress("idle");
          return;
        }

        if (currentUser) {
          setUser(currentUser);
          console.log("✅ UserContext: User found. Fetching user role...");
          setAuthProgress("fetching_profile", "Loading user permissions...");

          const role = await fetchUserRole(supabase, currentUser, setUserRole);

          if (mounted) {
            setAuthProgress("complete", "Session loaded successfully");
            // Reset to idle after a brief moment to show completion
            setTimeout(() => setAuthProgress("idle"), 1000);
          }
        } else {
          console.log(
            "ℹ️ UserContext: No user found. Setting loading to false.",
          );
          setUser(null);
          setUserRole(null);
          setAuthProgress("idle");
        }

        setIsLoading(false);

        // Set up auth state change listener
        console.log("👂 UserContext: Setting up auth state change listener...");
        const { data: listener } = supabase.auth.onAuthStateChange(
          async (event: string, session: Session | null) => {
            if (!mounted) return;

            console.log(`🔄 UserContext: Auth state changed: ${event}`);

            // Handle different auth events
            switch (event) {
              case "SIGNED_IN":
                console.log("✅ UserContext: User signed in");
                setAuthProgress("authenticating", "Signing you in...");
                setSession(session);
                setUser(session?.user || null);

                if (session?.user) {
                  setAuthProgress(
                    "fetching_profile",
                    "Loading your profile...",
                  );
                  const role = await fetchUserRole(
                    supabase,
                    session.user,
                    setUserRole,
                  );
                  setAuthProgress("redirecting", "Redirecting to dashboard...");
                }
                break;

              case "SIGNED_OUT":
                console.log("👋 UserContext: User signed out");
                setAuthProgress("idle", "Signed out successfully");
                setSession(null);
                setUser(null);
                setUserRole(null);
                // Reset to idle after showing completion
                setTimeout(() => setAuthProgress("idle"), 1500);
                break;

              case "TOKEN_REFRESHED":
                console.log("🔄 UserContext: Token refreshed");
                setSession(session);
                setUser(session?.user || null);
                if (session?.user) {
                  const role = await fetchUserRole(
                    supabase,
                    session.user,
                    setUserRole,
                  );
                }
                break;

              case "USER_UPDATED":
                console.log("📝 UserContext: User updated");
                setSession(session);
                setUser(session?.user || null);
                if (session?.user) {
                  const role = await fetchUserRole(
                    supabase,
                    session.user,
                    setUserRole,
                  );
                }
                break;

              default:
                console.log(`ℹ️ UserContext: Unhandled auth event: ${event}`);
                setSession(session);
                setUser(session?.user || null);
                if (session?.user) {
                  const role = await fetchUserRole(
                    supabase,
                    session.user,
                    setUserRole,
                  );
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
          setAuthProgress("idle");
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
  }, [supabase, setAuthProgress]);

  // Function to manually refresh user data
  const refreshUserData = async () => {
    if (!supabase) return;

    setIsLoading(true);
    setAuthProgress("fetching_profile", "Refreshing user data...");

    try {
      const {
        data: { user: currentUser },
        error: getUserError,
      } = await supabase.auth.getUser();

      if (getUserError) {
        throw getUserError;
      }

      setUser(currentUser);

      if (currentUser) {
        const role = await fetchUserRole(supabase, currentUser, setUserRole);
        setAuthProgress("complete", "Data refreshed successfully");
      } else {
        setUserRole(null);
        setAuthProgress("idle");
      }
    } catch (err) {
      console.error("❌ UserContext: Error refreshing user data:", err);
      setError("Failed to refresh user data");
      setAuthProgress("idle");
    } finally {
      setIsLoading(false);
      // Reset to idle after showing completion
      setTimeout(() => setAuthProgress("idle"), 1000);
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
        isAuthenticating,
        authProgress,
        refreshUserData,
        clearAuthError,
        setAuthProgress,
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
