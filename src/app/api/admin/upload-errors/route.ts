// src/app/api/admin/upload-errors/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/prismaDB";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const errorType = searchParams.get("errorType");
    const retryable = searchParams.get("retryable");
    const resolved = searchParams.get("resolved");
    const dateRange = searchParams.get("dateRange");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause for filtering
    const whereClause: any = {};

    if (errorType) {
      whereClause.errorType = errorType;
    }

    if (retryable !== null) {
      whereClause.retryable = retryable === 'true';
    }

    if (resolved !== null) {
      whereClause.resolved = resolved === 'true';
    }

    // Date range filtering
    if (dateRange) {
      const now = new Date();
      let startDate: Date;

      switch (dateRange) {
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0); // All time
      }

      whereClause.timestamp = {
        gte: startDate.toISOString()
      };
    }

    const errors = await prisma.uploadError.findMany({
      where: whereClause,
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset
    });

    const totalCount = await prisma.uploadError.count({ where: whereClause });

    return NextResponse.json({
      success: true,
      errors: errors.map(error => ({
        id: error.id,
        correlationId: error.correlationId,
        errorType: error.errorType,
        message: error.message,
        userMessage: error.userMessage,
        details: error.details ? JSON.parse(error.details) : null,
        userId: error.userId,
        timestamp: error.timestamp.toISOString(),
        retryable: error.retryable,
        resolved: error.resolved
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });
  } catch (error) {
    console.error("Error fetching upload errors:", error);
    return NextResponse.json(
      { error: "Failed to fetch upload errors" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const errorId = searchParams.get("errorId");
    const allResolved = searchParams.get("allResolved") === "true";

    if (allResolved) {
      // Delete all resolved errors
      const result = await prisma.uploadError.deleteMany({
        where: { resolved: true }
      });

      return NextResponse.json({
        success: true,
        deleted: result.count
      });
    } else if (errorId) {
      // Delete specific error
      await prisma.uploadError.delete({
        where: { id: errorId }
      });

      return NextResponse.json({
        success: true,
        deleted: 1
      });
    } else {
      return NextResponse.json(
        { error: "Either errorId or allResolved=true is required" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error deleting upload errors:", error);
    return NextResponse.json(
      { error: "Failed to delete upload errors" },
      { status: 500 }
    );
  }
}
