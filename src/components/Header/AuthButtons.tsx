import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@/contexts/UserContext";
import { onAuthEvent, requestAuthSync } from "@/utils/auth-events";

interface AuthButtonsProps {
  sticky: boolean;
  pathUrl: string;
}

// NEW: Helper function to determine display name based on role
const getDisplayName = (user: any, userRole: string | null): string => {
  if (!user) return "User";
  
  // Check if user has admin privileges
  const isAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'helpdesk';
  
  if (isAdmin) {
    // Show role-based display name for admin users
    if (userRole === 'super_admin') {
      return "Super Admin";
    } else if (userRole === 'admin') {
      return "Admin";
    } else if (userRole === 'helpdesk') {
      return "Help Desk";
    }
  }
  
  // For non-admin users, show their name or email
  return user.user_metadata?.name ||
         user.user_metadata?.full_name ||
         user.email?.split("@")?.[0] ||
         "User";
};

const AuthButtons: React.FC<AuthButtonsProps> = ({ sticky, pathUrl }) => {
  const { user, userRole, isLoading, authState } = useUser();

  // Enhanced state management for immediate UI updates
  const [optimisticAuthState, setOptimisticAuthState] = useState({
    isAuthenticated: false,
    user: null as any,
    userRole: null as string | null,
    isLoading: true,
  });

  // Initialize optimistic state from actual auth state
  useEffect(() => {
    setOptimisticAuthState({
      isAuthenticated: authState.isAuthenticated,
      user: user,
      userRole: userRole,
      isLoading: isLoading || !authState.isInitialized,
    });
  }, [authState.isAuthenticated, user, userRole, isLoading, authState.isInitialized]);

  // Enhanced auth event handling for immediate UI updates
  useEffect(() => {
    console.log("[AuthButtons] Setting up auth event listener");

    const unsubscribe = onAuthEvent((event) => {
      const { type, payload, source } = event.detail;
      console.log(`[AuthButtons] Received auth event: ${type}`, {
        payload,
        source,
      });

      switch (type) {
        case "login":
          console.log("[AuthButtons] Login event - updating optimistic state");
          setOptimisticAuthState((prev) => ({
            ...prev,
            isAuthenticated: true,
            user: payload?.user || prev.user,
            userRole: payload?.userRole || prev.userRole,
            isLoading: false,
          }));
          break;

        case "logout":
          console.log("[AuthButtons] Logout event - updating optimistic state");
          setOptimisticAuthState((prev) => ({
            ...prev,
            isAuthenticated: false,
            user: null,
            userRole: null,
            isLoading: false,
          }));
          break;

        case "auth-state-check":
          if (payload?.confirmed) {
            console.log(
              "[AuthButtons] Auth state confirmed - updating optimistic state",
            );
            setOptimisticAuthState((prev) => ({
              ...prev,
              isAuthenticated: true,
              user: payload?.user || prev.user,
              userRole: payload?.userRole || prev.userRole,
              isLoading: false,
            }));
          }
          break;

        case "session-refresh":
          console.log("[AuthButtons] Session refresh - requesting sync");
          // Request fresh auth sync to ensure UI is up to date
          requestAuthSync("session refresh from AuthButtons");
          break;

        default:
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Use optimistic state for immediate UI responsiveness
  const effectiveUser = optimisticAuthState.user;
  const effectiveUserRole = optimisticAuthState.userRole;
  const effectiveIsAuthenticated = optimisticAuthState.isAuthenticated;
  const effectiveIsLoading = optimisticAuthState.isLoading;

  // Show loading state only briefly during initialization
  if (effectiveIsLoading && !authState.isInitialized) {
    console.log("AuthButtons: Rendering loading state");
    return (
      <div className="flex items-center gap-4">
        <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"></div>
        <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"></div>
      </div>
    );
  }

  if (effectiveIsAuthenticated && effectiveUser) {
    // NEW: Get display name based on role
    const displayName = getDisplayName(effectiveUser, effectiveUserRole);
    
    return (
      <div className="flex items-center gap-4">
        <Link href={"/client"}>
          <div
            className="flex items-center rounded-lg border border-gray-200 bg-white px-6 py-2 shadow"
            style={{ minWidth: 120, justifyContent: "center" }}
          >
            <span
              className={`loginBtn text-base font-medium transition-colors duration-200 ${
                !sticky && pathUrl === "/"
                  ? "text-black"
                  : "text-black dark:text-white"
              }`}
            >
              {displayName}
            </span>
          </div>
        </Link>
        <SignOutButton sticky={sticky} pathUrl={pathUrl} />
      </div>
    );
  }

  return (
    <>
      <SignInButton sticky={sticky} pathUrl={pathUrl} />
      <SignUpButton sticky={sticky} pathUrl={pathUrl} />
    </>
  );
};

interface ButtonProps {
  sticky: boolean;
  pathUrl: string;
}

// Enhanced SignOut button with optimistic updates and better UX
const SignOutButton: React.FC<ButtonProps> = ({ sticky, pathUrl }) => {
  const { signOut } = useUser();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = useCallback(async () => {
    setIsLoading(true);
    console.log("[AuthButtons] Sign out initiated");

    try {
      await signOut();
      console.log("[AuthButtons] Sign out completed successfully");

      // Small delay to allow auth state to propagate
      setTimeout(() => {
        window.location.href = "/";
      }, 100);
    } catch (error) {
      console.error("[AuthButtons] Sign out error:", error);
      // Still redirect on error to prevent stuck state
      window.location.href = "/";
    } finally {
      setIsLoading(false);
    }
  }, [signOut]);

  return (
    <button
      onClick={handleSignOut}
      disabled={isLoading}
      className={`ml-0 rounded-lg bg-[#1743e3] px-7 py-3 text-base font-bold text-white shadow transition-all duration-300 ease-in-out ${
        isLoading
          ? "scale-95 cursor-not-allowed opacity-70"
          : "cursor-pointer border border-[#1743e3] hover:scale-105 hover:border-black hover:bg-transparent hover:text-black"
      }`}
      style={{ minWidth: 120 }}
    >
      {isLoading ? (
        <span className="flex items-center">
          <svg
            className="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Signing out...
        </span>
      ) : (
        "Sign Out"
      )}
    </button>
  );
};

const SignInButton: React.FC<ButtonProps> = ({ sticky, pathUrl }) => (
  <Link
    href="/sign-in"
    className="rounded-lg bg-white px-7 py-3 text-base font-medium text-black shadow-md transition-all duration-200 hover:scale-105 hover:bg-gray-100 hover:shadow-lg"
    style={{ marginRight: "12px" }}
  >
    Sign In
  </Link>
);

const SignUpButton: React.FC<ButtonProps> = ({ sticky, pathUrl }) => (
  <Link
    href="/sign-up"
    className="rounded-lg bg-amber-400 px-7 py-3 text-base font-medium text-black transition-all duration-200 hover:scale-105 hover:bg-amber-500 hover:shadow-lg"
  >
    Sign Up
  </Link>
);

export default AuthButtons;
