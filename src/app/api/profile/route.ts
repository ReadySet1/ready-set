// src/app/api/profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/utils/prismaDB";
import { createClient } from "@/utils/supabase/server";
import { PrismaTransaction } from "@/types/prisma-types";
import { AuthErrorType, AuthError, AuthRequestContext } from "@/types/auth";

// Enhanced error creation utility
const createAuthError = (
  type: AuthErrorType,
  message: string,
  retryable: boolean = true,
  details?: any
): AuthError => {
  return {
    type,
    message,
    retryable,
    timestamp: new Date(),
    details,
  };
};

// Enhanced request context creation
const createRequestContext = (request: Request): AuthRequestContext => {
  // Handle test environment where request.url might not be available
  const url = request.url ? new URL(request.url) : new URL('http://localhost/api/profile');
  return {
    requestId: Math.random().toString(36).substring(7),
    timestamp: new Date(),
    path: url.pathname,
    method: request.method || 'GET',
    headers: Object.fromEntries(request.headers?.entries() || []),
  };
};

// Enhanced authentication validation
const validateAuthentication = async (requestContext: AuthRequestContext) => {
  const startTime = Date.now();
  
  try {
    console.log(`[Profile API] [${requestContext.requestId}] Starting authentication validation`);
    
    // Initialize Supabase client
    const supabase = await createClient();
    console.log(`[Profile API] [${requestContext.requestId}] Supabase client created`);
    
    // Get user session from Supabase with enhanced error handling
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    const duration = Date.now() - startTime;
    console.log(`[Profile API] [${requestContext.requestId}] Auth check completed in ${duration}ms:`, {
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message,
      duration,
    });
    
    if (userError) {
      console.error(`[Profile API] [${requestContext.requestId}] Authentication error:`, userError);
      throw createAuthError(
        AuthErrorType.INVALID_TOKEN,
        "Authentication failed",
        true,
        userError
      );
    }
    
    if (!user) {
      console.log(`[Profile API] [${requestContext.requestId}] No authenticated user found`);
      throw createAuthError(
        AuthErrorType.USER_NOT_FOUND,
        "No authenticated user found",
        false
      );
    }
    
    // Update request context with user info
    requestContext.userId = user.id;
    
    // Get user role for additional validation
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("type")
      .eq("id", user.id)
      .single();
    
    if (profileError) {
      console.warn(`[Profile API] [${requestContext.requestId}] Could not fetch user role:`, profileError);
      // Don't throw here, as the main profile fetch will handle this
    } else {
      requestContext.userRole = profile?.type;
      console.log(`[Profile API] [${requestContext.requestId}] User role: ${profile?.type}`);
    }
    
    return { user, profile };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Profile API] [${requestContext.requestId}] Authentication validation failed after ${duration}ms:`, error);
    throw error;
  }
};

// Enhanced database query with timeout and connection health check
const fetchUserProfile = async (userId: string, requestContext: AuthRequestContext) => {
  const startTime = Date.now();
  
  try {
    console.log(`[Profile API] [${requestContext.requestId}] Fetching profile from database for user: ${userId}`);
    
    // Add timeout to prevent hanging queries
    const queryPromise = prisma.profile.findUnique({
      where: { id: userId },
      select: {
        id: true,
        type: true,
        email: true,
        name: true,
        contactName: true,
        contactNumber: true,
        companyName: true,
        image: true,
        status: true,
        // Address fields
        street1: true,
        street2: true,
        city: true,
        state: true,
        zip: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    
    // Add 10 second timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database query timeout')), 10000)
    );
    
    const userData = await Promise.race([queryPromise, timeoutPromise]);
    
    const duration = Date.now() - startTime;
    console.log(`[Profile API] [${requestContext.requestId}] Database query completed in ${duration}ms:`, {
      found: !!userData,
      userId: userData?.id,
      userType: userData?.type,
      duration,
    });
    
    return userData;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Profile API] [${requestContext.requestId}] Database query failed after ${duration}ms:`, error);
    
    if (error instanceof Error && error.message.includes('timeout')) {
      throw createAuthError(
        AuthErrorType.DATABASE_ERROR,
        "Database query timeout",
        true,
        error
      );
    }
    
    throw createAuthError(
      AuthErrorType.DATABASE_ERROR,
      "Failed to fetch user profile",
      true,
      error
    );
  }
};

// Enhanced response creation with proper headers
const createResponse = (data: any, status: number = 200, requestContext?: AuthRequestContext) => {
  const response = NextResponse.json(data, { status });
  
  // Add enhanced headers for better caching and security
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  if (requestContext) {
    response.headers.set('X-Request-ID', requestContext.requestId);
    response.headers.set('X-Response-Time', `${Date.now() - requestContext.timestamp.getTime()}ms`);
  }
  
  return response;
};

export async function GET(request: Request) {
  const requestContext = createRequestContext(request);
  const startTime = Date.now();
  
  try {
    console.log(`[Profile API] [${requestContext.requestId}] Starting profile fetch request`);
    
    // Validate authentication
    const { user } = await validateAuthentication(requestContext);
    
    // Fetch user profile from database
    const userData = await fetchUserProfile(user.id, requestContext);
    
    if (!userData) {
      console.log(`[Profile API] [${requestContext.requestId}] User profile not found in database`);
      return createResponse(
        { 
          error: "User profile not found",
          requestId: requestContext.requestId,
        }, 
        404, 
        requestContext
      );
    }
    
    const totalDuration = Date.now() - startTime;
    console.log(`[Profile API] [${requestContext.requestId}] Profile data retrieved successfully in ${totalDuration}ms`);
    
    return createResponse(
      {
        ...userData,
        requestId: requestContext.requestId,
        fetchedAt: new Date().toISOString(),
      },
      200,
      requestContext
    );
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[Profile API] [${requestContext.requestId}] Error fetching user profile after ${totalDuration}ms:`, error);
    
    // Handle different types of errors
    if (error && typeof error === 'object' && 'type' in error) {
      const authError = error as AuthError;
      
      if (authError.type === AuthErrorType.USER_NOT_FOUND || authError.type === AuthErrorType.INVALID_TOKEN) {
        return createResponse(
          { 
            error: "Unauthorized",
            requestId: requestContext.requestId,
            details: authError.message,
          }, 
          401, 
          requestContext
        );
      }
      
      if (authError.type === AuthErrorType.DATABASE_ERROR) {
        return createResponse(
          { 
            error: "Database error",
            requestId: requestContext.requestId,
            details: authError.message,
          }, 
          500, 
          requestContext
        );
      }
    }
    
    // Generic error response
    return createResponse(
      { 
        error: "Internal Server Error",
        requestId: requestContext.requestId,
      }, 
      500, 
      requestContext
    );
  }
}

export async function POST(request: Request) {
  const requestContext = createRequestContext(request);
  const startTime = Date.now();
  
  try {
    console.log(`[Profile API] [${requestContext.requestId}] Starting profile creation request`);
    
    // Parse request body
    const { profileData, userTableData } = await request.json();
    
    // Validate authentication
    const { user } = await validateAuthentication(requestContext);
    
    console.log(`[Profile API] [${requestContext.requestId}] POST auth check:`, {
      hasUser: !!user,
      userId: user?.id,
      requestId: requestContext.requestId,
    });
    
    // Verify that the user is creating their own profile
    if (user.id !== profileData.auth_user_id) {
      console.log(`[Profile API] [${requestContext.requestId}] User trying to create profile for another user`);
      return createResponse(
        { 
          error: "Unauthorized to create profile for another user",
          requestId: requestContext.requestId,
        }, 
        403, 
        requestContext
      );
    }

    console.log(`[Profile API] [${requestContext.requestId}] Creating profile using server-side operations`);
    
    // Begin transaction for all database operations
    const result = await prisma.$transaction(async (tx: PrismaTransaction) => {
      // Initialize Supabase client for profile creation
      const supabase = await createClient();
      
      // 1. Insert profile into Supabase profiles table
      const { data: profileResult, error: profileError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select();
        
      if (profileError) {
        console.error(`[Profile API] [${requestContext.requestId}] Profile creation error:`, profileError);
        throw new Error(`Profile creation failed: ${profileError.message}`);
      }
      
      console.log(`[Profile API] [${requestContext.requestId}] Profile created successfully in Supabase`);
      
      // 2. Insert user data into profiles table
      const { data: userTableResult, error: userTableError } = await supabase
        .from('profiles')
        .insert(userTableData)
        .select();
        
      if (userTableError) {
        console.error(`[Profile API] [${requestContext.requestId}] User record creation error:`, userTableError);
        // Continue anyway since profile was created
      } else {
        console.log(`[Profile API] [${requestContext.requestId}] User record created successfully in Supabase`);
      }
      
      // 3. Update user metadata with role
      const { error: updateError } = await supabase.auth.updateUser({
        data: { role: userTableData.type },
      });
      
      if (updateError) {
        console.error(`[Profile API] [${requestContext.requestId}] Error updating user metadata:`, updateError);
        // Continue anyway since critical operations succeeded
      } else {
        console.log(`[Profile API] [${requestContext.requestId}] User metadata updated successfully`);
      }
      
      return { success: true, profileId: profileData.auth_user_id };
    });
    
    const totalDuration = Date.now() - startTime;
    console.log(`[Profile API] [${requestContext.requestId}] Profile creation completed successfully in ${totalDuration}ms`);
    
    return createResponse({ 
      success: true, 
      message: 'Profile created successfully',
      data: result,
      requestId: requestContext.requestId,
    });
    
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[Profile API] [${requestContext.requestId}] Error in profile API route after ${totalDuration}ms:`, error);
    
    // Handle different types of errors
    if (error && typeof error === 'object' && 'type' in error) {
      const authError = error as AuthError;
      
      if (authError.type === AuthErrorType.USER_NOT_FOUND || authError.type === AuthErrorType.INVALID_TOKEN) {
        return createResponse(
          { 
            error: "Unauthorized",
            requestId: requestContext.requestId,
            details: authError.message,
          }, 
          401, 
          requestContext
        );
      }
      
      if (authError.type === AuthErrorType.DATABASE_ERROR) {
        return createResponse(
          { 
            error: "Database error",
            requestId: requestContext.requestId,
            details: authError.message,
          }, 
          500, 
          requestContext
        );
      }
    }
    
    // Generic error response
    return createResponse(
      { 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        requestId: requestContext.requestId,
      },
      500,
      requestContext
    );
  }
}