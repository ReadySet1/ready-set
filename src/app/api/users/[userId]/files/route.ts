import { NextResponse } from "next/server";
import { prisma } from "@/utils/prismaDB";
import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { storage } from '@/utils/supabase/storage';
import { UserType } from "@/types/prisma";


// SECURITY FIX: Proper authorization function with no bypasses
async function checkAuthorization(requestedUserId: string) {
  try {
    const supabase = await createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const { data, error } = await supabase.auth.getUser();
    
    // Log authentication details for debugging
                
    // SECURITY FIX: Remove dangerous UUID length bypass
    // All requests must be properly authenticated
    if (error || !data.user) {
      console.error("Auth error:", error?.message || "No authenticated user found");
      return NextResponse.json({ error: "Unauthorized - Please log in" }, { status: 401 });
    }
    
    // Allow access if the user is requesting their own profile
    if (data.user.id === requestedUserId) {
            return null; // Authorized
    }
    
    // Check if the user has an admin role in the Supabase auth metadata
    const userRole = data.user.app_metadata?.role || data.user.role;
    if (userRole === 'admin' || userRole === 'super_admin') {
            return null; // Authorized for admins by auth metadata
    }
    
    // Get the user's type from your database as a fallback
    const userData = await prisma.profile.findUnique({
      where: { id: data.user.id },
      select: { type: true }
    });
    
    // Allow access if the user is an admin, super_admin, or helpdesk user in database profile
    if (userData?.type === UserType.ADMIN || userData?.type === UserType.SUPER_ADMIN || userData?.type === UserType.HELPDESK) {
            return null; // Authorized for admins and helpdesk by profile
    }
    
    // Deny access for all other cases
        return NextResponse.json({ error: "Forbidden - Insufficient permissions" }, { status: 403 });
  }
  catch (error) {
    console.error("Authorization check error:", error);
    return NextResponse.json({ error: "Internal server error during authorization" }, { status: 500 });
  }
}

// GET: Fetch files for a specific user
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const params = await context.params;
    const userId = params.userId;

    // Validate UUID format before querying database
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json([], { status: 200 }); // Return empty array for invalid UUIDs
    }

    // Check authorization
    const authResponse = await checkAuthorization(userId);
    if (authResponse) return authResponse;
    
        
    // Fetch files for this user from the database
    const files = await prisma.fileUpload.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    });
    
        
    // Map the files to a more user-friendly format
    const formattedFiles = files.map((file: any) => ({
      id: file.id,
      fileName: file.fileName,
      fileUrl: file.fileUrl,
      fileType: file.fileType,
      fileSize: file.fileSize,
      category: file.category,
      uploadedAt: file.uploadedAt,
      userId: file.userId
    }));
    
    return NextResponse.json(formattedFiles);
  } catch (error: unknown) {
    console.error("Error fetching user files:", error);
    let errorMessage = "Failed to fetch user files";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 