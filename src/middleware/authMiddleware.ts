// src/middleware/authMiddleware.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { UserType } from "@/types/prisma";
// Remove static import
// import { createClient } from "@/utils/supabase/server";

import { prisma } from "@/utils/prismaDB";

// Helper function to check if user has admin privileges
function hasAdminPrivileges(userType: string): boolean {
  // Handle both lowercase and uppercase user types
  const normalizedType = userType?.toUpperCase();
  return normalizedType === 'ADMIN' || normalizedType === 'SUPER_ADMIN' || normalizedType === 'HELPDESK';
}

export async function validateAdminRole(request: Request) {
  try {
    // Dynamically import and create Supabase client
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    
    // Get the authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    // Check if the user is authenticated
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.profile.findUnique({
      where: { email: user.email },
      select: { type: true, deletedAt: true },
    });

    // Check if user account has been soft-deleted
    if (dbUser?.deletedAt) {
      return NextResponse.json({ error: "Account has been deactivated" }, { status: 403 });
    }

    if (!dbUser || !hasAdminPrivileges(dbUser.type)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return null; // Validation passed
  } catch (error) {
    console.error("Auth middleware error:", error);
    return NextResponse.json({ error: "Authentication error" }, { status: 500 });
  }
}