import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { UserType, UserStatus } from "@/types/prisma";
import { Prisma } from "@prisma/client";

const MAX_IDS_LIMIT = 1000;

/**
 * GET /api/users/bulk/ids
 * Get all user IDs matching the specified filters
 * Used for "Select All Matching" functionality
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

    // Check permissions
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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as UserStatus | null;
    const type = searchParams.get("type") as UserType | null;
    const search = searchParams.get("search");
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    // Build where clause
    const where: Prisma.ProfileWhereInput = {
      // Exclude SUPER_ADMIN users from bulk selection
      type: { not: UserType.SUPER_ADMIN },
    };

    // Filter by deleted status
    if (includeDeleted) {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }

    // Filter by status (only for active users)
    if (status && !includeDeleted) {
      where.status = status;
    }

    // Filter by type (but still exclude SUPER_ADMIN)
    if (type && type !== UserType.SUPER_ADMIN) {
      where.type = type;
    }

    // Search filter
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { email: { contains: searchTerm, mode: "insensitive" } },
        { name: { contains: searchTerm, mode: "insensitive" } },
        { contactName: { contains: searchTerm, mode: "insensitive" } },
        { companyName: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    // Fetch user IDs with limit
    const users = await prisma.profile.findMany({
      where,
      select: { id: true },
      take: MAX_IDS_LIMIT,
      orderBy: { createdAt: "desc" },
    });

    const ids = users.map((u) => u.id);

    // Get total count (may be more than limit)
    const totalCount = await prisma.profile.count({ where });

    return NextResponse.json({
      ids,
      count: ids.length,
      totalCount,
      hasMore: totalCount > MAX_IDS_LIMIT,
    });
  } catch (error) {
    console.error("Error fetching bulk user IDs:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch user IDs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
