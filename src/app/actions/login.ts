// src/app/actions/login.ts

"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

import { UserType } from "@/types/user";

// Define protected role-specific routes (copied from routeProtection.ts to avoid circular dependency)
const PROTECTED_ROUTES: Record<string, RegExp> = {
  admin: /^\/admin(\/.*)?$/,
  super_admin: /^\/admin(\/.*)?$/,
  driver: /^\/driver(\/.*)?$/,
  helpdesk: /^\/helpdesk(\/.*)?$|^\/admin(\/.*)?$/,
  vendor: /^\/vendor(\/.*)?$/,
  client: /^\/client(\/.*)?$/
};

// Define default home routes for each user type
const USER_HOME_ROUTES: Record<string, string> = {
  admin: "/admin",
  super_admin: "/admin",
  driver: "/driver",
  helpdesk: "/helpdesk",
  vendor: "/vendor",
  client: "/client"
};

export interface FormState {
  error?: string;
  redirectTo?: string;
  // NEW: Add authentication state for client-side sync
  authSuccess?: boolean;
  userId?: string;
  userEmail?: string;
}

export async function login(
  prevState: FormState | null,
  formData: FormData
): Promise<FormState> {
  await cookies();
  const supabase = await createClient();

  const email = formData.get("email")?.toString().toLowerCase() || "";
  const password = formData.get("password")?.toString() || "";
  const returnTo = formData.get("returnTo")?.toString();

  console.log("🔍 Login attempt for email:", email);

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  // Test connection to Supabase first
  try {
    const { data: connectionTest, error: connectionError } = await supabase
      .from("profiles")
      .select("count")
      .limit(1);
    
    console.log("✅ Supabase connection test:", connectionTest ? "SUCCESS" : "FAILED");
    if (connectionError) {
      console.error("❌ Supabase connection error:", connectionError);
    }
  } catch (testError) {
    console.error("❌ Supabase connection test failed:", testError);
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  console.log("🔐 Auth attempt result:", error ? `FAILED: ${error.message}` : "SUCCESS");

  if (error) {
    // Check if user exists in profiles table
    const { data: userData, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    console.log("👤 Profile lookup result:", {
      found: !!userData,
      email: userData?.email,
      error: profileError?.message
    });

    return userData 
      ? { error: "Incorrect password. Please try again or use Magic Link." }
      : { error: "Account not found. Please check your email or sign up." };
  }

  // Get user profile to determine the correct dashboard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Failed to get user data" };
  }

  console.log("✅ Login successful for user:", user.id);

  // Get user type from profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("type")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error fetching user profile:", profileError);
    return { error: "Failed to get user profile" };
  }

  if (!profile?.type) {
    console.error("No profile type found for user:", user.id);
    return { error: "User profile type not found" };
  }

  console.log("User profile type from DB:", profile.type);
  
  // Normalize the user type to lowercase for consistent handling
  const userTypeKey = profile.type.toLowerCase();
  console.log("Normalized user type for redirection:", userTypeKey);

  // Determine where to redirect the user
  let redirectPath: string;

  // If returnTo is provided and the user has access to that path, use it
  if (returnTo && returnTo !== '/') {
    // Check if the user has access to the returnTo path
    const hasAccess = PROTECTED_ROUTES[userTypeKey]?.test(returnTo);
    
    if (hasAccess) {
      console.log("Redirecting user to returnTo path:", returnTo);
      redirectPath = returnTo;
    } else {
      // If user doesn't have access to returnTo path, use their default home route
      redirectPath = USER_HOME_ROUTES[userTypeKey] || "/";
      console.log("User doesn't have access to returnTo path, redirecting to default home:", redirectPath);
    }
  } else {
    // Use the default home route for this user type
    redirectPath = USER_HOME_ROUTES[userTypeKey] || "/";
    console.log("No valid returnTo path provided, redirecting to default home:", redirectPath);
  }

  // NEW: Set authentication state for client-side synchronization
  console.log("🔄 Setting authentication state for client-side sync");
  
  // Note: We can't directly access client-side utilities from server actions,
  // but we can return state that the client can use to trigger immediate sync
  const authState: FormState = {
    authSuccess: true,
    userId: user.id,
    userEmail: user.email || email,
    redirectTo: redirectPath
  };

  // Always redirect to the determined path
  console.log("🚀 Final redirect destination:", redirectPath);
  redirect(redirectPath);

  // This is unreachable but satisfies TypeScript
  return authState;
}

export async function signup(formData: FormData) {
  // Use cookies() to opt out of caching
  await cookies();

  // Create and await the Supabase client
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Form validation
  if (!email || !password) {
    redirect("/sign-in?error=Email+and+password+are+required");
  }

  // Password strength validation (optional)
  if (password.length < 8) {
    redirect("/sign-in?error=Password+must+be+at+least+8+characters+long");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  // Check if email confirmation is required
  const emailConfirmationRequired = !data.session;
  if (emailConfirmationRequired) {
    // Redirect to a confirmation page
    redirect("/signup-confirmation");
  } else {
    // If email confirmation is not required, redirect to home
    redirect("/");
  }
}
