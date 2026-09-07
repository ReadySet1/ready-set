import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/prismaDB";
import { withAuth } from "@/lib/auth-middleware";

const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN", "HELPDESK"];

/**
 * Ownership check for non-staff callers, keyed on the entity the where
 * clause targets. Job application files are staff-only (applicants upload
 * anonymously and never list existing files).
 */
async function callerOwnsEntity(
  whereClause: {
    userId?: string;
    cateringRequestId?: string;
    onDemandId?: string;
    jobApplicationId?: string;
  },
  userId: string
): Promise<boolean> {
  if (whereClause.userId) {
    return whereClause.userId === userId;
  }
  if (whereClause.cateringRequestId) {
    const order = await prisma.cateringRequest.findFirst({
      where: { id: whereClause.cateringRequestId, userId, deletedAt: null },
      select: { id: true },
    });
    return order !== null;
  }
  if (whereClause.onDemandId) {
    const order = await prisma.onDemand.findFirst({
      where: { id: whereClause.onDemandId, userId, deletedAt: null },
      select: { id: true },
    });
    return order !== null;
  }
  return false;
}

export async function GET(request: NextRequest) {
  // Middleware does not run for /api/*. File records carry signed URLs, so
  // callers may only list entities they own; staff may list anything.
  const auth = await withAuth(request, { requireAuth: true });
  if (!auth.success || !auth.context.user) {
    return auth.response ?? NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const caller = auth.context.user;
  const callerIsStaff = STAFF_ROLES.includes(caller.type?.toUpperCase());

  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const entityType = searchParams.get("entityType") || "user";
    const category = searchParams.get("category");

    
    if (!entityId) {
            return NextResponse.json(
        { error: "Entity ID is required" },
        { status: 400 }
      );
    }

    // Handle "new" as a special case - return empty file list
    if (entityId === 'new') {
      return NextResponse.json({
        success: true,
        files: [],
      });
    }

    // Validate UUID format before querying database
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(entityId)) {
      return NextResponse.json(
        { error: "Invalid entity ID format" },
        { status: 400 }
      );
    }

    // Build where clause for DB query
    const whereClause: any = {};

    // Handle category normalization
    if (category) {
      // Map category variations to consistent values
      const normalizedCategory = category.toLowerCase();
      
      // Use startsWith to handle compound categories like "catering-order::temp-123..."
      // This ensures we find both exact matches and subcategories
      whereClause.category = {
        startsWith: normalizedCategory
      };
      
          }

    // Handle entity type normalization
    const normalizedEntityType = entityType.toLowerCase();
        
    // Critical fix: If category is catering-order and entityType is user, we need to query by cateringRequestId
    if (category?.toLowerCase() === "catering-order") {
      // For catering orders, regardless of entityType parameter, use cateringRequestId
      whereClause.cateringRequestId = entityId;
          } else if (normalizedEntityType === "user") {
      whereClause.userId = entityId;
    } else if (normalizedEntityType === "catering" || normalizedEntityType === "catering-order") {
      whereClause.cateringRequestId = entityId;
    } else if (normalizedEntityType === "on_demand" || normalizedEntityType === "ondemand") {
      whereClause.onDemandId = entityId;
    } else if (normalizedEntityType === "job_application" || normalizedEntityType === "jobapplication") {
      whereClause.jobApplicationId = entityId;
    } else {
      console.warn('Unknown entityType:', entityType);
      return NextResponse.json(
        { error: `Invalid entityType: ${entityType}` },
        { status: 400 }
      );
    }


    if (!callerIsStaff) {
      const owned = await callerOwnsEntity(whereClause, caller.id);
      if (!owned) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const files = await prisma.fileUpload.findMany({
      where: whereClause,
      orderBy: {
        uploadedAt: "desc",
      },
      take: 100,
    });

    
    return NextResponse.json({
      success: true,
      files: files.map((file: any) => ({
        key: file.id,
        name: file.fileName,
        url: file.fileUrl,
        type: file.fileType,
        size: file.fileSize,
        category: file.category,
        uploadedAt: file.uploadedAt,
      })),
    });
  } catch (error) {
    console.error("Error retrieving files:", error);
    return NextResponse.json(
      { error: "Failed to retrieve files" },
      { status: 500 }
    );
  }
} 