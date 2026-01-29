import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { UserType } from "@/types/prisma";
import { userBulkOperationsService } from "@/services/userBulkOperationsService";
import type { BulkDeleteRequest } from "@/types/bulk-operations";

/**
 * POST /api/users/bulk/delete
 * Bulk soft delete multiple users
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

    // Check permissions - only ADMIN and SUPER_ADMIN can delete users
    const userData = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true },
    });

    if (
      !userData ||
      (userData.type !== UserType.ADMIN && userData.type !== UserType.SUPER_ADMIN)
    ) {
      return NextResponse.json(
        { error: "Forbidden - Admin permissions required" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userIds, reason } = body;

    // Validate request
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds must be a non-empty array" },
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

    // Prevent self-deletion
    if (userIds.includes(user.id)) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // Perform bulk soft delete
    const bulkRequest: BulkDeleteRequest = {
      userIds,
      reason,
    };

    const results = await userBulkOperationsService.bulkSoftDelete(
      bulkRequest,
      user.id
    );

    return NextResponse.json({
      message: `Bulk delete completed. ${results.totalSuccess} succeeded, ${results.totalFailed} failed.`,
      results,
    });
  } catch (error) {
    console.error("Error in bulk delete:", error);
    return NextResponse.json(
      {
        error: "Failed to perform bulk delete",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
