// src/app/api/users/[userId]/purge/route.ts

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from '@/utils/prismaDB';
import { UserType } from '@/types/prisma';

/**
 * DELETE: Permanently delete a soft-deleted user (GDPR compliance)
 * - Restricted to SUPER_ADMIN only
 * - Requires double confirmation mechanism
 * - Permanently removes user and associated data from database
 * - Creates audit log entry for the permanent deletion
 */
export async function DELETE(request: NextRequest) {
  console.log(`[DELETE /api/users/[userId]/purge] Request received for URL: ${request.url}`);
  
  try {
    // Get userId from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 2]; // Get userId from the path before 'purge'
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Parse request body for confirmation
    let confirmationData: { confirmed: boolean; reason?: string } | null = null;
    try {
      const body = await request.json();
      confirmationData = body;
    } catch {
      return NextResponse.json(
        { error: 'Request body with confirmation is required' },
        { status: 400 }
      );
    }

    if (!confirmationData?.confirmed) {
      return NextResponse.json(
        { error: 'Confirmation required. Set "confirmed": true in request body.' },
        { status: 400 }
      );
    }
    
    // Authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[DELETE /api/users/[userId]/purge] Authentication required:", authError);
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }
    
    console.log(`[DELETE /api/users/[userId]/purge] Authenticated user ID: ${user.id}`);

    // Check permissions - only SUPER_ADMIN can permanently delete users
    let requesterProfile;
    
    try {
      requesterProfile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { type: true }
      });
      console.log(`[DELETE /api/users/[userId]/purge] Requester profile fetched:`, requesterProfile);
      
      const isSuperAdmin = requesterProfile?.type === UserType.SUPER_ADMIN;

      if (!isSuperAdmin) {
        console.log(`[DELETE /api/users/[userId]/purge] Forbidden: User ${user.id} (type: ${requesterProfile?.type}) attempted to permanently delete user ${userId}.`);
        return NextResponse.json(
          { error: 'Forbidden: Only Super Admin can permanently delete users' },
          { status: 403 }
        );
      }
    } catch (profileError) {
      console.error(`[DELETE /api/users/[userId]/purge] Error fetching requester profile (ID: ${user.id}):`, profileError);
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
      console.log(`[DELETE /api/users/[userId]/purge] Target user fetched:`, targetUser ? 'Found' : 'Not Found');
    } catch (targetUserError) {
      console.error(`[DELETE /api/users/[userId]/purge] Error fetching target user (ID: ${userId}):`, targetUserError);
      return NextResponse.json({ error: 'Failed to fetch target user' }, { status: 500 });
    }

    if (!targetUser) {
      console.log(`[DELETE /api/users/[userId]/purge] User not found: ID ${userId}`);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!targetUser.deletedAt) {
      console.log(`[DELETE /api/users/[userId]/purge] User is not soft deleted: ID ${userId}`);
      return NextResponse.json(
        { error: 'User must be soft deleted before permanent deletion' },
        { status: 409 }
      );
    }

    // Prevent permanent deletion of SUPER_ADMIN users
    if (targetUser.type === UserType.SUPER_ADMIN) {
      console.log(`[DELETE /api/users/[userId]/purge] Cannot permanently delete Super Admin: ID ${userId}`);
      return NextResponse.json(
        { error: 'Super Admin users cannot be permanently deleted' },
        { status: 403 }
      );
    }

    // Additional confirmation check - require specific reason for permanent deletion
    if (!confirmationData.reason || confirmationData.reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'Detailed reason for permanent deletion is required (minimum 10 characters)' },
        { status: 400 }
      );
    }

    console.log(`[DELETE /api/users/[userId]/purge] Starting permanent deletion process for user: ${userId}`);
    console.log(`[DELETE /api/users/[userId]/purge] Requester: ${user.id} (Type: ${requesterProfile?.type})`);
    console.log(`[DELETE /api/users/[userId]/purge] Reason: ${confirmationData.reason}`);

    // Import the soft delete service
    const { userSoftDeleteService } = await import('@/services/userSoftDeleteService');
    
    // Perform permanent deletion
    const result = await userSoftDeleteService.permanentlyDeleteUser(userId);
    
    console.log(`[DELETE /api/users/[userId]/purge] User permanently deleted successfully: ID ${userId}`);
    
    return NextResponse.json({
      message: 'User permanently deleted successfully',
      summary: {
        deletedUser: {
          id: result.userId,
          email: targetUser.email,
          type: targetUser.type
        },
        deletedAt: result.deletedAt,
        deletedBy: result.deletedBy,
        reason: confirmationData.reason,
        affectedRecords: result.affectedRecords,
        timestamp: new Date().toISOString()
      },
      warning: 'This action is irreversible. User data has been permanently removed from the database.'
    });
  } catch (error) {
    console.error('[DELETE /api/users/[userId]/purge] Unexpected error:', error);
    
    // Handle business logic errors
    if (error instanceof Error) {
      if (error.message.includes('User must be soft deleted before permanent deletion')) {
        return NextResponse.json(
          { 
            error: error.message,
            code: 'NOT_SOFT_DELETED'
          },
          { status: 409 }
        );
      }
      
      if (error.message.includes('Super Admin users cannot be permanently deleted')) {
        return NextResponse.json(
          { 
            error: error.message,
            code: 'SUPER_ADMIN_PROTECTED'
          },
          { status: 403 }
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
        error: 'Failed to permanently delete user',
        code: 'PERMANENT_DELETE_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
