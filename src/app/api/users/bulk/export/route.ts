import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { UserType, UserStatus } from "@/types/prisma";
import { userBulkOperationsService } from "@/services/userBulkOperationsService";
import type { BulkExportParams } from "@/types/bulk-operations";

/**
 * GET /api/users/bulk/export
 * Export users to CSV format
 */
export async function GET(request: NextRequest) {
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

    // Check permissions - only ADMIN and SUPER_ADMIN can export users
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const userIdsParam = searchParams.get("userIds");
    const statusParam = searchParams.get("status");
    const typeParam = searchParams.get("type");
    const includeDeletedParam = searchParams.get("includeDeleted");

    // Build export params
    const exportParams: BulkExportParams = {
      includeDeleted: includeDeletedParam === "true",
    };

    // Parse userIds if provided
    if (userIdsParam) {
      const userIds = userIdsParam.split(",").filter(Boolean);

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

      exportParams.userIds = userIds;
    }

    // Validate and set status filter
    if (statusParam) {
      if (!Object.values(UserStatus).includes(statusParam as UserStatus)) {
        return NextResponse.json(
          {
            error: `Invalid status. Must be one of: ${Object.values(UserStatus).join(", ")}`,
          },
          { status: 400 }
        );
      }
      exportParams.status = statusParam as UserStatus;
    }

    // Validate and set type filter
    if (typeParam) {
      if (!Object.values(UserType).includes(typeParam as UserType)) {
        return NextResponse.json(
          {
            error: `Invalid type. Must be one of: ${Object.values(UserType).join(", ")}`,
          },
          { status: 400 }
        );
      }
      exportParams.type = typeParam as UserType;
    }

    // Generate CSV
    const csvContent =
      await userBulkOperationsService.exportUsersToCSV(exportParams);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `users-export-${timestamp}.csv`;

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error in bulk export:", error);
    return NextResponse.json(
      {
        error: "Failed to export users",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
