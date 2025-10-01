// src/app/api/admin/upload-errors/[id]/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/prismaDB";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const errorId = params.id;

    if (!errorId) {
      return NextResponse.json(
        { error: "Error ID is required" },
        { status: 400 }
      );
    }

    // Update the error to mark it as resolved
    const updatedError = await prisma.uploadError.update({
      where: { id: errorId },
      data: { resolved: true }
    });

    return NextResponse.json({
      success: true,
      error: {
        id: updatedError.id,
        correlationId: updatedError.correlationId,
        errorType: updatedError.errorType,
        message: updatedError.message,
        userMessage: updatedError.userMessage,
        resolved: updatedError.resolved,
        timestamp: updatedError.timestamp.toISOString()
      }
    });
  } catch (error) {
    console.error("Error resolving upload error:", error);

    if (error instanceof Error && error.message.includes("Record to update not found")) {
      return NextResponse.json(
        { error: "Error not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to resolve error" },
      { status: 500 }
    );
  }
}
