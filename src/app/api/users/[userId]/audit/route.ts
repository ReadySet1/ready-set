/**
 * GET /api/users/[userId]/audit
 *
 * Fetch audit history for a specific user with filtering and pagination.
 * Only accessible by Admin, Super Admin, and Helpdesk users.
 */

import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { UserType } from "@/types/prisma";
import { userAuditService } from "@/services/userAuditService";
import { AuditAction } from "@/types/audit";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    // Extract userId from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const userIdIndex = pathParts.indexOf("users") + 1;
    const userId = pathParts[userIdIndex];

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Validate UUID format
    if (!UUID_REGEX.test(userId)) {
      return NextResponse.json(
        { error: "Invalid user ID format" },
        { status: 400 }
      );
    }

    // Authenticate the request
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required" },
        { status: 401 }
      );
    }

    // Check permissions - only Admin, Super Admin, and Helpdesk can view audit logs
    const requesterProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true },
    });

    const isAuthorized =
      requesterProfile?.type === UserType.ADMIN ||
      requesterProfile?.type === UserType.SUPER_ADMIN ||
      requesterProfile?.type === UserType.HELPDESK;

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions to view audit logs" },
        { status: 403 }
      );
    }

    // Verify target user exists
    const targetUser = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = url;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );

    // Parse action filters (can be multiple)
    const actionParams = searchParams.getAll("action");
    const actions =
      actionParams.length > 0
        ? (actionParams.filter((a) =>
            Object.values(AuditAction).includes(a as AuditAction)
          ) as AuditAction[])
        : undefined;

    // Parse date filters
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // Validate dates
    if (startDateParam && isNaN(startDate!.getTime())) {
      return NextResponse.json(
        { error: "Invalid startDate format. Use ISO 8601 format." },
        { status: 400 }
      );
    }
    if (endDateParam && isNaN(endDate!.getTime())) {
      return NextResponse.json(
        { error: "Invalid endDate format. Use ISO 8601 format." },
        { status: 400 }
      );
    }

    // Parse performedBy filter
    const performedBy = searchParams.get("performedBy") || undefined;
    if (performedBy && !UUID_REGEX.test(performedBy)) {
      return NextResponse.json(
        { error: "Invalid performedBy ID format" },
        { status: 400 }
      );
    }

    // Fetch audit logs
    const result = await userAuditService.getAuditLogs({
      userId,
      page,
      limit,
      actions,
      startDate,
      endDate,
      performedBy,
    });

    // Transform response to snake_case for API consistency
    return NextResponse.json({
      logs: result.logs.map((log) => ({
        id: log.id,
        user_id: log.userId,
        action: log.action,
        performed_by: log.performedBy,
        performer_name: log.performerName,
        performer_email: log.performerEmail,
        performer_image: log.performerImage,
        changes: log.changes,
        reason: log.reason,
        metadata: log.metadata,
        created_at: log.createdAt,
      })),
      pagination: {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total_count: result.pagination.totalCount,
        total_pages: result.pagination.totalPages,
        has_next_page: result.pagination.hasNextPage,
        has_prev_page: result.pagination.hasPrevPage,
      },
      filters: {
        available_actions: result.filters.availableActions,
      },
    });
  } catch (error) {
    console.error("[GET /api/users/[userId]/audit] Error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
