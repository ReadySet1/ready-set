import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { UserType } from "@/types/prisma";
import { userBulkOperationsService } from "@/services/userBulkOperationsService";
import type { BulkRoleChangeRequest } from "@/types/bulk-operations";

/**
 * POST /api/users/bulk/role
 * Bulk change role for multiple users
 * SUPER_ADMIN only - stricter authorization than other bulk operations
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Must be signed in" },
        { status: 401 }
      );
    }

    // Check permissions - SUPER_ADMIN ONLY
    const userData = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true },
    });

    if (!userData || userData.type !== UserType.SUPER_ADMIN) {
      return NextResponse.json(
        { error: "Forbidden - Super Admin permissions required for role changes" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userIds, newRole, reason } = body;

    // Validate request
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = Object.values(UserType);
    if (!newRole || !validRoles.includes(newRole)) {
      return NextResponse.json(
        {
          error: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Prevent assigning SUPER_ADMIN role via bulk operations
    if (newRole === UserType.SUPER_ADMIN) {
      return NextResponse.json(
        { error: "Cannot assign SUPER_ADMIN role via bulk operations" },
        { status: 400 }
      );
    }

    // Validate UUID format for all IDs
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const id of userIds) {
      if (!uuidRegex.test(id)) {
        return NextResponse.json(
          { error: `Invalid user ID format: ${id}` },
          { status: 400 }
        );
      }
    }

    // Check if user is trying to change their own role
    if (userIds.includes(user.id)) {
      return NextResponse.json(
        { error: "Cannot change your own role via bulk operations" },
        { status: 400 }
      );
    }

    // Perform bulk role change
    const bulkRequest: BulkRoleChangeRequest = {
      userIds,
      newRole,
      reason,
    };

    const results = await userBulkOperationsService.bulkRoleChange(
      bulkRequest,
      user.id
    );

    return NextResponse.json({
      message: `Bulk role change completed. ${results.totalSuccess} succeeded, ${results.totalFailed} failed.`,
      results,
    });
  } catch (error) {
    console.error("Error in bulk role change:", error);
    return NextResponse.json(
      {
        error: "Failed to perform bulk role change",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
