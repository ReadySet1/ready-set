import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  User,
  SupabaseClient,
  Session,
  AuthChangeEvent,
} from "@supabase/supabase-js";

interface AuthButtonsProps {
  sticky: boolean;
  pathUrl: string;
}

const AuthButtons: React.FC<AuthButtonsProps> = ({ sticky, pathUrl }) => {
  const [user, setUser] = useState<User | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Supabase client
  useEffect(() => {
    const initSupabase = async () => {
      try {
        const client = await createClient();
        setSupabase(client);
      } catch (error) {
        console.error("Error initializing Supabase client:", error);
        setIsLoading(false);
      }
    };

    initSupabase();
  }, []);

  useEffect(() => {
    // Optimistic UI: Check for cached session in localStorage
    if (typeof window !== "undefined") {
      try {
        const cachedSession = localStorage.getItem("sb-auth-token");
        if (cachedSession) {
          const sessionObj = JSON.parse(cachedSession);
          if (sessionObj?.user) {
            setUser(sessionObj.user);
            setIsLoading(false);
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    // Get the current user when component mounts
    const getUser = async () => {
      try {
        const {
          data: { user, session },
          error,
        } = await supabase.auth.getUser();
        if (error) throw error;
        setUser(user);
        // Store session in localStorage for optimistic UI
        if (typeof window !== "undefined" && session) {
          localStorage.setItem("sb-auth-token", JSON.stringify(session));
        }
      } catch (error) {
        // If Supabase validation fails, clear cache
        if (typeof window !== "undefined") {
          localStorage.removeItem("sb-auth-token");
        }
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    getUser();

    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === "SIGNED_IN" && session) {
          setUser(session.user);
          if (typeof window !== "undefined") {
            localStorage.setItem("sb-auth-token", JSON.stringify(session));
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem("sb-auth-token");
          }
        }
      },
    );

    // Clean up subscription
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-4">
        <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200"></div>
        <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200"></div>
      </div>
    );
  }

  if (user) {
    return (
      <>
        <Link href={"/client"}>
          <p
            className={`loginBtn px-7 py-3 text-base font-medium ${
              !sticky && pathUrl === "/" ? "text-white" : "text-black"
            }`}
          >
            {user.user_metadata?.name ||
              user.user_metadata?.full_name ||
              user.email?.split("@")[0] ||
              "User"}
          </p>
        </Link>
        <SignOutButton sticky={sticky} pathUrl={pathUrl} />
      </>
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

const SignOutButton: React.FC<ButtonProps> = ({ sticky, pathUrl }) => {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  // Initialize Supabase client
  useEffect(() => {
    const initSupabase = async () => {
      try {
        const client = await createClient();
        setSupabase(client);
      } catch (error) {
        console.error("Error initializing Supabase client:", error);
      }
    };

    initSupabase();
  }, []);

  const handleSignOut = async () => {
    if (!supabase) {
      console.error("Supabase client not initialized");
      return;
    }

    try {
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      className={`signUpBtn rounded-lg px-6 py-3 text-base font-medium duration-300 ease-in-out ${
        pathUrl !== "/" || sticky
          ? "bg-blue-800 bg-opacity-100 text-white hover:bg-opacity-20 hover:text-dark"
          : "bg-blue-800 bg-opacity-20 text-white hover:bg-opacity-100 hover:text-white"
      }`}
    >
      Sign Out
    </button>
  );
};

const SignInButton: React.FC<ButtonProps> = ({ sticky, pathUrl }) => (
  <Link
    href="/sign-in"
    className="rounded-lg bg-white px-7 py-3 text-base font-medium text-black shadow-md transition duration-200 hover:bg-gray-100"
    style={{ marginRight: "12px" }}
  >
    Sign In
  </Link>
);

const SignUpButton: React.FC<ButtonProps> = ({ sticky, pathUrl }) => (
  <Link
    href="/sign-up"
    className="rounded-lg bg-amber-400 px-7 py-3 text-base font-medium text-black transition duration-200 hover:bg-amber-500"
  >
    Sign Up
  </Link>
);

export default AuthButtons;
