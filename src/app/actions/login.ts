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
  success?: boolean;
  userType?: string;
  message?: string;
}

export async function login(
  prevState: FormState | null,
  formData: FormData
): Promise<FormState> {
  const startTime = Date.now();
  const requestId = `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🚀 [${requestId}] Login attempt started`);
  
  try {
    await cookies();
    const supabase = await createClient();

    const email = formData.get("email")?.toString().toLowerCase() || "";
    const password = formData.get("password")?.toString() || "";
    const returnTo = formData.get("returnTo")?.toString();

    console.log(`🔍 [${requestId}] Login attempt for email: ${email}, returnTo: ${returnTo || 'default'}`);

    // Enhanced input validation with specific error messages
    if (!email || !password) {
      const missingFields = [];
      if (!email) missingFields.push('email');
      if (!password) missingFields.push('password');
      
      console.log(`❌ [${requestId}] Validation failed: Missing ${missingFields.join(', ')}`);
      return { 
        error: `Please provide ${missingFields.join(' and ')} to continue.`,
        success: false 
      };
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log(`❌ [${requestId}] Validation failed: Invalid email format`);
      return { 
        error: "Please enter a valid email address.",
        success: false 
      };
    }

    // Test connection to Supabase first
    console.log(`🔌 [${requestId}] Testing Supabase connection...`);
    try {
      const { data: connectionTest, error: connectionError } = await supabase
        .from("profiles")
        .select("count")
        .limit(1);
      
      if (connectionError) {
        console.error(`❌ [${requestId}] Supabase connection error:`, connectionError);
        return { 
          error: "Unable to connect to authentication service. Please try again later.",
          success: false 
        };
      }
      
      console.log(`✅ [${requestId}] Supabase connection test: SUCCESS`);
    } catch (testError) {
      console.error(`❌ [${requestId}] Supabase connection test failed:`, testError);
      return { 
        error: "Authentication service is temporarily unavailable. Please try again later.",
        success: false 
      };
    }

    // Attempt authentication
    console.log(`🔐 [${requestId}] Attempting authentication...`);
    const { error: authError, data: authData } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.log(`❌ [${requestId}] Authentication failed: ${authError.message}`);
      
      // Enhanced error handling with specific messages
      if (authError.message.includes('Invalid login credentials')) {
        // Check if user exists in profiles table for more specific error
        try {
          const { data: userData, error: profileError } = await supabase
            .from("profiles")
            .select("email, type")
            .eq("email", email)
            .maybeSingle();

          if (profileError) {
            console.error(`❌ [${requestId}] Profile lookup error:`, profileError);
          }

          if (userData) {
            console.log(`❌ [${requestId}] User exists but password is incorrect`);
            return { 
              error: "Incorrect password. Please check your password and try again, or use Magic Link for password-free sign in.",
              success: false 
            };
          } else {
            console.log(`❌ [${requestId}] User account not found`);
            return { 
              error: "Account not found. Please check your email address or sign up for a new account.",
              success: false 
            };
          }
        } catch (profileLookupError) {
          console.error(`❌ [${requestId}] Profile lookup failed:`, profileLookupError);
          return { 
            error: "Unable to verify account status. Please try again or contact support.",
            success: false 
          };
        }
      } else if (authError.message.includes('Email not confirmed')) {
        return { 
          error: "Please check your email and click the confirmation link before signing in.",
          success: false 
        };
      } else if (authError.message.includes('Too many requests')) {
        return { 
          error: "Too many login attempts. Please wait a few minutes before trying again.",
          success: false 
        };
      } else {
        // Generic error with logging for debugging
        console.error(`❌ [${requestId}] Unexpected auth error:`, authError);
        return { 
          error: "Authentication failed. Please try again or contact support if the problem persists.",
          success: false 
        };
      }
    }

    // Authentication successful - get user profile
    console.log(`✅ [${requestId}] Authentication successful, fetching user profile...`);
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    
    if (getUserError || !user) {
      console.error(`❌ [${requestId}] Failed to get user data:`, getUserError);
      return { 
        error: "Login successful but unable to retrieve user information. Please try again.",
        success: false 
      };
    }

    // Get user type from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("type, email")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error(`❌ [${requestId}] Error fetching user profile:`, profileError);
      return { 
        error: "Login successful but unable to determine user role. Please contact support.",
        success: false 
      };
    }

    if (!profile?.type) {
      console.error(`❌ [${requestId}] No profile type found for user: ${user.id}`);
      return { 
        error: "Login successful but user profile is incomplete. Please contact support.",
        success: false 
      };
    }

    console.log(`👤 [${requestId}] User profile retrieved: type=${profile.type}, email=${profile.email}`);
    
    // Normalize the user type to lowercase for consistent handling
    const userTypeKey = profile.type.toLowerCase();
    console.log(`🎯 [${requestId}] Normalized user type for redirection: ${userTypeKey}`);

    // Determine where to redirect the user
    let redirectPath: string;

    // If returnTo is provided and the user has access to that path, use it
    if (returnTo && returnTo !== '/') {
      // Check if the user has access to the returnTo path
      const hasAccess = PROTECTED_ROUTES[userTypeKey]?.test(returnTo);
      
      if (hasAccess) {
        console.log(`🔄 [${requestId}] Redirecting user to returnTo path: ${returnTo}`);
        redirectPath = returnTo;
      } else {
        // If user doesn't have access to returnTo path, use their default home route
        redirectPath = USER_HOME_ROUTES[userTypeKey] || "/";
        console.log(`⚠️ [${requestId}] User doesn't have access to returnTo path ${returnTo}, redirecting to default home: ${redirectPath}`);
      }
    } else {
      // Use the default home route for this user type
      redirectPath = USER_HOME_ROUTES[userTypeKey] || "/";
      console.log(`🏠 [${requestId}] No valid returnTo path provided, redirecting to default home: ${redirectPath}`);
    }

    // Calculate execution time
    const executionTime = Date.now() - startTime;
    console.log(`✅ [${requestId}] Login successful! Redirecting to: ${redirectPath} (took ${executionTime}ms)`);

    // Return success state before redirect
    const successState: FormState = {
      success: true,
      redirectTo: redirectPath,
      userType: profile.type,
      message: `Welcome back! Redirecting to your dashboard...`
    };

    // Log success metrics for monitoring
    console.log(`📊 [${requestId}] Login metrics:`, {
      email: email,
      userType: profile.type,
      redirectPath: redirectPath,
      executionTime: `${executionTime}ms`,
      timestamp: new Date().toISOString()
    });

    // Always redirect to the determined path
    redirect(redirectPath);

    // This is unreachable but satisfies TypeScript
    return successState;
    
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error(`💥 [${requestId}] Unexpected error during login:`, {
      error: error.message,
      stack: error.stack,
      executionTime: `${executionTime}ms`,
      timestamp: new Date().toISOString()
    });

    // Return a user-friendly error message
    return {
      error: "An unexpected error occurred during login. Please try again or contact support if the problem persists.",
      success: false
    };
  }
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
