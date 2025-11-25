// src/app/api/users/[userId]/restore/route.ts

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from '@/utils/prismaDB';
import { UserType } from '@/types/prisma';

/**
 * POST: Restore a soft-deleted user
 * - Restricted to ADMIN/SUPER_ADMIN roles
 * - Restores user by clearing deletedAt, deletedBy, and deletionReason fields
 * - Creates audit log entry for the restore action
 */
export async function POST(request: NextRequest) {
  try {
    // Get userId from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 2]; // Get userId from the path before 'restore'
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[POST /api/users/[userId]/restore] Authentication required:", authError);
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // Check permissions - only ADMIN and SUPER_ADMIN can restore users
    let requesterProfile;
    
    try {
      requesterProfile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { type: true }
      });
      
      const isAdminOrSuperAdmin =
        requesterProfile?.type === UserType.ADMIN ||
        requesterProfile?.type === UserType.SUPER_ADMIN;

      if (!isAdminOrSuperAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Only Admin or Super Admin can restore users' },
          { status: 403 }
        );
      }
    } catch (profileError) {
      console.error(`[POST /api/users/[userId]/restore] Error fetching requester profile (ID: ${user.id}):`, profileError);
      return NextResponse.json({ error: 'Failed to fetch requester profile' }, { status: 500 });
    }

    // Check if target user exists and is soft deleted
    let targetUser;
    try {
      targetUser = await prisma.profile.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          email: true, 
          type: true,
          deletedAt: true,
          deletedBy: true,
          deletionReason: true
        }
      });
    } catch (targetUserError) {
      console.error(`[POST /api/users/[userId]/restore] Error fetching target user (ID: ${userId}):`, targetUserError);
      return NextResponse.json({ error: 'Failed to fetch target user' }, { status: 500 });
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!targetUser.deletedAt) {
      return NextResponse.json(
        { error: 'User is not soft deleted' },
        { status: 409 }
      );
    }

    // Import the soft delete service
    const { userSoftDeleteService } = await import('@/services/userSoftDeleteService');
    
    // Perform restore
    const result = await userSoftDeleteService.restoreUser(userId, user.id);
    
    return NextResponse.json({
      message: 'User restored successfully',
      summary: {
        restoredUser: {
          id: result.userId,
          email: targetUser.email,
          type: targetUser.type
        },
        restoredAt: result.restoredAt,
        restoredBy: result.restoredBy,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[POST /api/users/[userId]/restore] Unexpected error:', error);
    
    // Handle business logic errors
    if (error instanceof Error) {
      if (error.message.includes('User is not soft deleted')) {
        return NextResponse.json(
          { 
            error: error.message,
            code: 'NOT_SOFT_DELETED'
          },
          { status: 409 }
        );
      }
      
      if (error.message.includes('User not found')) {
        return NextResponse.json(
          { 
            error: error.message,
            code: 'USER_NOT_FOUND'
          },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to restore user',
        code: 'RESTORE_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
