import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { prisma } from "@/utils/prismaDB";
import { UserType } from "@/types/prisma";

// Helper function to check if user has admin privileges
function hasAdminPrivileges(userType: string): boolean {
  // Handle both lowercase and uppercase user types
  const normalizedType = userType?.toUpperCase();
  return normalizedType === 'ADMIN' || normalizedType === 'SUPER_ADMIN' || normalizedType === 'HELPDESK';
}

/**
 * Gets the authenticated user from an API request using the Authorization header
 * 
 * @param request The Next.js request object
 * @returns Object containing the authenticated user or error response
 */
export async function getAuthenticatedUser(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        error: NextResponse.json(
          { error: "Unauthorized - Invalid authorization header" },
          { status: 401 }
        )
      };
    }

    // Extract the token
    const token = authHeader.split(' ')[1];
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Verify the token by getting the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return {
        error: NextResponse.json(
          { error: "Unauthorized - Invalid JWT token" },
          { status: 401 }
        )
      };
    }

    return { user };
  } catch (error) {
    console.error("Authentication error:", error);
    return {
      error: NextResponse.json(
        { error: "Internal server error during authentication" },
        { status: 500 }
      )
    };
  }
}

/**
 * Checks if the authenticated user has admin privileges
 * 
 * @param userId User ID to check for admin privileges
 * @returns Object containing admin status or error response
 */
export async function checkAdminPrivileges(userId: string) {
  try {
    const dbUser = await prisma.profile.findUnique({
      where: { id: userId },
      select: { type: true },
    });

    if (!dbUser?.type || !hasAdminPrivileges(dbUser.type)) {
      return {
        error: NextResponse.json(
          { error: "Forbidden - Insufficient permissions" },
          { status: 403 }
        )
      };
    }

    return { 
      isAdmin: true, 
      userType: dbUser.type 
    };
  } catch (error) {
    console.error("Admin check error:", error);
    return {
      error: NextResponse.json(
        { error: "Internal server error checking permissions" },
        { status: 500 }
      )
    };
  }
}

/**
 * Authenticates a request and checks for admin privileges in one step
 * 
 * @param request The Next.js request object
 * @returns Object containing the authenticated admin user or error response
 */
export async function authenticateAdminRequest(request: NextRequest) {
  const authResult = await getAuthenticatedUser(request);
  
  if (authResult.error) {
    return authResult;
  }

  const adminResult = await checkAdminPrivileges(authResult.user.id);
  
  if (adminResult.error) {
    return adminResult;
  }

  return { 
    user: authResult.user,
    userType: adminResult.userType,
    isAdmin: true
  };
}

export async function validateApiAuth(request: NextRequest): Promise<{
  isValid: boolean;
  user?: any;
  userType?: UserType;
  error?: string;
}> {
  try {
    // Get session from cookies
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return { isValid: false, error: "No session token found" };
    }

    // Find user session
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true }
    });

    if (!session || !session.user) {
      return { isValid: false, error: "Invalid session" };
    }

    // Check if session is expired
    if (session.expires < new Date()) {
      return { isValid: false, error: "Session expired" };
    }

    return {
      isValid: true,
      user: session.user,
      userType: session.user.type as UserType
    };
  } catch (error) {
    console.error("Auth validation error:", error);
    return { isValid: false, error: "Authentication failed" };
  }
} 