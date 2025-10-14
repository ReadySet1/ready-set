import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/prismaDB";

export async function GET(request: NextRequest) {
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
      console.log('GET /api/file-uploads/get - Special case: entityId="new", returning empty list');
      return NextResponse.json({
        success: true,
        files: [],
      });
    }

    // Validate UUID format before querying database
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(entityId)) {
      console.log(`GET /api/file-uploads/get - Invalid UUID format: ${entityId}`);
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

    
    const files = await prisma.fileUpload.findMany({
      where: whereClause,
      orderBy: {
        uploadedAt: "desc",
      },
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