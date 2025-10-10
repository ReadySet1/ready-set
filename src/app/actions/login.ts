// src/app/actions/login.ts

"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/utils/supabase/server";

import { UserType } from "@/types/user";

// Define protected role-specific routes (copied from routeProtection.ts to avoid circular dependency)
const PROTECTED_ROUTES: Record<string, RegExp> = {
  admin: /^\/admin(\/.*)?$/,
  super_admin: /^\/admin(\/.*)?$/,
  driver: /^\/driver(\/.*)?$/,
  helpdesk: /^\/helpdesk(\/.*)?$|^\/admin(\/.*)?$/,
  vendor: /^\/client(\/.*)?$/,
  client: /^\/client(\/.*)?$/
};

// Define default home routes for each user type
const USER_HOME_ROUTES: Record<string, string> = {
  admin: "/admin",
  super_admin: "/admin",
  driver: "/driver",
  helpdesk: "/helpdesk",
  vendor: "/client",
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

  if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
    console.log(`🚀 [${requestId}] Login attempt started`);
  }
  
  // Use cookies() to opt out of caching
  await cookies();
  const supabase = await createClient();

    const email = formData.get("email")?.toString().toLowerCase() || "";
    const password = formData.get("password")?.toString() || "";
    const returnTo = formData.get("returnTo")?.toString();

    if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
      console.log(`🔍 [${requestId}] Login attempt for email: ${email}, returnTo: ${returnTo || 'default'}`);
    }

    // Enhanced input validation with specific error messages
    if (!email || !password) {
      const missingFields = [];
      if (!email) missingFields.push('email');
      if (!password) missingFields.push('password');
      
      if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
        console.log(`❌ [${requestId}] Validation failed: Missing ${missingFields.join(', ')}`);
      }
      return { 
        error: `Please provide ${missingFields.join(' and ')} to continue.`,
        success: false 
      };
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
        console.log(`❌ [${requestId}] Validation failed: Invalid email format`);
      }
      return { 
        error: "Please enter a valid email address.",
        success: false 
      };
    }

    // Test connection to Supabase first
    if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
      console.log(`🔌 [${requestId}] Testing Supabase connection...`);
    }
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
      
      if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
        console.log(`✅ [${requestId}] Supabase connection test: SUCCESS`);
      }
    } catch (testError) {
      console.error(`❌ [${requestId}] Supabase connection test failed:`, testError);
      return { 
        error: "Authentication service is temporarily unavailable. Please try again later.",
        success: false 
      };
    }

    // Attempt authentication
    if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
      console.log(`🔐 [${requestId}] Attempting authentication...`);
    }
    const { error: authError, data: authData } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
        console.log(`❌ [${requestId}] Authentication failed: ${authError.message}`);
      }

      // Enhanced error handling with specific messages
      if (authError.message.includes('Invalid login credentials')) {
        // Check if user exists in profiles table for more specific error
        try {
          const { data: userData, error: profileError } = await supabase
            .from("profiles")
            .select("email, type")
            .eq("email", email)
            .maybeSingle();

          if (profileError && process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
            console.error(`❌ [${requestId}] Profile lookup error:`, profileError);
          }

          if (userData) {
            if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
              console.log(`❌ [${requestId}] User exists but password is incorrect`);
            }
            return {
              error: "Incorrect password. Please check your password and try again, or use Magic Link for password-free sign in.",
              success: false
            };
          } else {
            if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
              console.log(`❌ [${requestId}] User account not found`);
            }
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
        // Check if this user exists and if email confirmation is actually required
        try {
          console.log(`⚠️ [${requestId}] Email not confirmed error - checking if user exists in profiles`);
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("id, email, type")
            .eq("email", email)
            .maybeSingle();

          // If user exists in profiles, they might be a legacy user from before confirmation was disabled
          if (profileData && !profileError) {
            console.log(`ℹ️ [${requestId}] User exists in profiles - this appears to be a legacy unconfirmed user`);
            console.log(`🔧 [${requestId}] Since email confirmation is disabled in config, attempting automatic fix...`);
            
            // Try to sign up the user again with the same credentials
            // This should work since email confirmation is disabled and will create a confirmed account
            console.log(`🔄 [${requestId}] Attempting to re-register user with confirmed status...`);
            
            let signupData, signupError;
            try {
              const result = await supabase.auth.signUp({
                email,
                password,
                options: {
                  emailRedirectTo: undefined // Disable email confirmation since it's disabled in config
                }
              });
              signupData = result.data;
              signupError = result.error;
              console.log(`📊 [${requestId}] Signup result:`, { 
                hasData: !!signupData, 
                hasUser: !!signupData?.user, 
                hasSession: !!signupData?.session,
                errorMessage: signupError?.message 
              });
            } catch (signupException) {
              console.error(`💥 [${requestId}] Signup exception:`, signupException);
              signupError = signupException as any;
            }

            if (signupError) {
              console.error(`❌ [${requestId}] Re-registration failed:`, signupError);
              
              // If signup fails because user already exists, that's actually good!
              if (signupError.message.includes('User already registered')) {
                console.log(`✅ [${requestId}] User already exists, trying direct auth bypass...`);
                return { 
                  error: "Your account needs activation. Please try logging in again, or contact support if the issue persists.",
                  success: false 
                };
              }
              
              return { 
                error: "Account activation failed. Please contact support or try signing up again.",
                success: false 
              };
            }

            // If signup succeeded, the user should now be confirmed and logged in
            if (signupData && signupData.user && signupData.session) {
              console.log(`✅ [${requestId}] User successfully re-registered with confirmed status`);
              
              // Continue with the normal login flow since the user is now authenticated
              const user = signupData.user;
              
              // Get user profile to determine redirect
              const { data: profile, error: newProfileError } = await supabase
                .from("profiles")
                .select("type, email")
                .eq("id", user.id)
                .single();

              if (newProfileError || !profile?.type) {
                console.error(`❌ [${requestId}] Error fetching user profile after re-registration:`, newProfileError);
                return {
                  error: "Account activated but unable to determine user role. Please contact support.",
                  success: false
                };
              }

              const userType = profile.type!.toLowerCase(); // profile.type is guaranteed to be non-null here
              // If returnTo is just "/" (root), prioritize the user's home route
              const redirectPath = (returnTo && returnTo !== "/") ? returnTo : USER_HOME_ROUTES[userType] || "/";
              
              console.log(`✅ [${requestId}] Login successful after re-registration. User type: ${userType}, redirecting to: ${redirectPath}`);
              
              redirect(redirectPath);
            } else {
              console.log(`❌ [${requestId}] Re-registration completed but no session created`);
              return { 
                error: "Account activation incomplete. Please try logging in again.",
                success: false 
              };
            }
          } else {
            console.log(`❌ [${requestId}] User not found in profiles`);
            return { 
              error: "Please check your email and click the confirmation link before signing in.",
              success: false 
            };
          }
        } catch (checkError) {
          console.error(`❌ [${requestId}] Error checking user profile:`, checkError);
          return { 
            error: "Please check your email and click the confirmation link before signing in.",
            success: false 
          };
        }
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

    // Get user profile to determine user type
    console.log(`🔍 [${requestId}] Fetching user profile for user: ${user.id}`);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("type, email")
      .eq("id", user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error(`❌ [${requestId}] Error fetching user profile:`, profileError);
      return {
        error: "Login successful but unable to retrieve user information. Please try again.",
        success: false
      };
    }

    // Get user type from profile (or create if missing)
    let userType: string | undefined = profile?.type;

    // If no profile exists, create one with default values
    if (!profile) {
      console.log(`⚠️ [${requestId}] No profile found for user ${user.id}, creating default profile...`);

      try {
        // Use admin client to bypass RLS policies for profile creation
        const adminSupabase = await createAdminClient();

        // Use upsert to handle existing profiles gracefully
        const { data: newProfile, error: createError } = await adminSupabase
          .from("profiles")
          .upsert({
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            type: 'CLIENT', // Default to CLIENT as the most common user type
            status: 'ACTIVE',
            updatedAt: new Date().toISOString()
          }, {
            onConflict: 'id'
          })
          .select("type, email")
          .single();

        if (createError) {
          console.error(`❌ [${requestId}] Error creating default profile:`, createError);
          return {
            error: "Login successful but unable to create user profile. Please contact support.",
            success: false
          };
        }

        userType = newProfile?.type || undefined;
        console.log(`✅ [${requestId}] Default profile created/updated successfully for user: ${user.id}`);
      } catch (createProfileError) {
        console.error(`❌ [${requestId}] Exception creating default profile:`, createProfileError);
        return {
          error: "Login successful but unable to set up user account. Please contact support.",
          success: false
        };
      }
    }

    // Double-check that we have a valid profile and userType
    if (!profile && !userType) {
      console.error(`❌ [${requestId}] Profile creation failed and no existing profile found for user: ${user.id}`);
      return {
        error: "Login successful but unable to access user profile. Please contact support.",
        success: false
      };
    }

    if (!userType) {
      console.error(`❌ [${requestId}] No profile type found for user: ${user.id}`);
      return {
        error: "Login successful but user profile is incomplete. Please contact support.",
        success: false
      };
    }

  if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
    console.log("User profile type from DB:", userType);
  }

  // Normalize the user type to lowercase for consistent handling
  const userTypeKey = userType?.toLowerCase() || 'client';

  if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
    console.log("Normalized user type for redirection:", userTypeKey);
  }

  // Set immediate session data in cookies for client-side access
  const cookieStore = await cookies();

  // Set user session data that can be read immediately by client
  // Normalize userRole to match TypeScript enum (lowercase)
  const normalizedUserRole = userType ? Object.values(UserType).find(
    enumValue => enumValue.toUpperCase() === (userType as string)?.toUpperCase()
  ) || (userType as string)?.toLowerCase() : 'customer';

  const sessionData = {
    userId: user.id,
    email: user.email || '',
    userRole: normalizedUserRole,
    timestamp: Date.now()
  };

  if (process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
    console.log("Normalized userRole for session:", normalizedUserRole);
  }

  // Set session cookie with enhanced security - allow client access for hydration
  cookieStore.set('user-session-data', JSON.stringify(sessionData), {
    path: '/',
    httpOnly: false, // Allow client-side access for hydration
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    // Additional security headers
    ...(process.env.NODE_ENV === 'production' && {
      domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
    })
  });

  // Prefetch and cache user profile data for faster client-side loading
  try {
    const { prefetchUserProfile } = await import("@/utils/supabase/client");
    // Note: This will run on server, so we manually cache the profile data
    const profileData = {
      type: normalizedUserRole,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0] || '',
      timestamp: Date.now()
    };
    
    // Set a server-side cache cookie that client can read immediately
    cookieStore.set(`user-profile-${user.id}`, JSON.stringify(profileData), {
      path: '/',
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    });
  } catch (error) {
    console.error("Error prefetching user profile data:", error);
    // Don't fail login if prefetch fails
  }

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
      userType: userType,
      message: `Welcome back! Redirecting to your dashboard...`
    };

    // Log success metrics for monitoring BEFORE redirect
    console.log(`📊 [${requestId}] Login metrics:`, {
      email: email,
      userType: userType || 'unknown',
      redirectPath: redirectPath,
      executionTime: `${executionTime}ms`,
      timestamp: new Date().toISOString()
    });

    // Store session data in a way that can be accessed by the client
    // Use a client-accessible cookie that survives the redirect
    cookieStore.set('temp-session-data', JSON.stringify(sessionData), {
      path: '/',
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60, // Short-lived cookie, will be cleaned up by client
    });

    // IMPORTANT: Return the redirect path instead of calling redirect()
    // This ensures cookies are properly committed before the client-side redirect
    // The client will handle the actual redirect using router.push()
     return {
       success: true,
       redirectTo: redirectPath,
       userType: userType || 'unknown',
       message: `Welcome back! Redirecting to your dashboard...`
     };
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
