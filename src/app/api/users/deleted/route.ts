// src/app/api/users/deleted/route.ts

import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from '@/utils/prismaDB';
import { UserType } from '@/types/prisma';
import { DeletedUserFilters } from '@/services/userSoftDeleteService';

/**
 * GET: List soft-deleted users with filtering and pagination
 * - Admin only endpoint
 * - Supports filtering by type, status, deletedBy, date range, and search
 * - Returns paginated results with user details and deletion information
 */
export async function GET(request: NextRequest) {
  console.log(`[GET /api/users/deleted] Request received for URL: ${request.url}`);
  
  try {
    // Authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[GET /api/users/deleted] Authentication required:", authError);
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }
    
    console.log(`[GET /api/users/deleted] Authenticated user ID: ${user.id}`);

    // Check permissions - only ADMIN, SUPER_ADMIN, and HELPDESK can view deleted users
    let requesterProfile;
    
    try {
      requesterProfile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { type: true }
      });
      console.log(`[GET /api/users/deleted] Requester profile fetched:`, requesterProfile);
      
      const isAdminOrHelpdesk =
        requesterProfile?.type === UserType.ADMIN ||
        requesterProfile?.type === UserType.SUPER_ADMIN ||
        requesterProfile?.type === UserType.HELPDESK;

      if (!isAdminOrHelpdesk) {
        console.log(`[GET /api/users/deleted] Forbidden: User ${user.id} (type: ${requesterProfile?.type}) attempted to view deleted users.`);
        return NextResponse.json(
          { error: 'Forbidden: Only Admin, Super Admin, or Helpdesk can view deleted users' },
          { status: 403 }
        );
      }
    } catch (profileError) {
      console.error(`[GET /api/users/deleted] Error fetching requester profile (ID: ${user.id}):`, profileError);
      return NextResponse.json({ error: 'Failed to fetch requester profile' }, { status: 500 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filters: DeletedUserFilters = {
      type: searchParams.get('type') as UserType || undefined,
      status: searchParams.get('status') || undefined,
      deletedBy: searchParams.get('deletedBy') || undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '10', 10),
    };

    // Parse date filters
    if (searchParams.get('deletedAfter')) {
      filters.deletedAfter = new Date(searchParams.get('deletedAfter')!);
    }
    if (searchParams.get('deletedBefore')) {
      filters.deletedBefore = new Date(searchParams.get('deletedBefore')!);
    }

    console.log(`[GET /api/users/deleted] Filters:`, filters);

    // Import the soft delete service
    const { userSoftDeleteService } = await import('@/services/userSoftDeleteService');
    
    // Get deleted users
    const result = await userSoftDeleteService.getDeletedUsers(filters);
    
    console.log(`[GET /api/users/deleted] Found ${result.users.length} deleted users out of ${result.pagination.totalCount} total`);
    
    return NextResponse.json({
      message: 'Deleted users retrieved successfully',
      data: result.users,
      pagination: result.pagination,
      filters: {
        applied: filters,
        available: {
          types: Object.values(UserType),
          statuses: ['ACTIVE', 'PENDING', 'DELETED'],
        }
      }
    });
  } catch (error) {
    console.error('[GET /api/users/deleted] Unexpected error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve deleted users',
        code: 'FETCH_DELETED_USERS_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
