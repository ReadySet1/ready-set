import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { UserType } from "@/types/prisma";
import { userBulkOperationsService } from "@/services/userBulkOperationsService";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/users/bulk/import
 * Import users from CSV file
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

    // Check permissions - ADMIN or SUPER_ADMIN
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

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      return NextResponse.json(
        { error: "File must be a CSV" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Read file content
    const csvContent = await file.text();

    // Validate CSV has content
    if (!csvContent.trim()) {
      return NextResponse.json(
        { error: "CSV file is empty" },
        { status: 400 }
      );
    }

    // Validate CSV has header row
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV must have a header row and at least one data row" },
        { status: 400 }
      );
    }

    // Validate expected headers
    const expectedHeaders = [
      "Email",
      "Name",
      "Type",
      "Status",
      "Contact Name",
      "Contact Number",
      "Company Name",
      "Website",
      "Street 1",
      "Street 2",
      "City",
      "State",
      "ZIP",
    ];

    const firstLine = lines[0];
    if (!firstLine) {
      return NextResponse.json(
        { error: "CSV file has no header row" },
        { status: 400 }
      );
    }

    const headerRow = firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const missingHeaders = expectedHeaders
      .slice(0, 4) // Only Email, Name, Type, Status are required
      .filter((h) => !headerRow.some((actual) => actual.toLowerCase() === h.toLowerCase()));

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: `Missing required headers: ${missingHeaders.join(", ")}` },
        { status: 400 }
      );
    }

    // Perform bulk import
    const results = await userBulkOperationsService.bulkImportUsers(
      csvContent,
      user.id
    );

    return NextResponse.json({
      message: `Import completed. ${results.totalSuccess} users created, ${results.totalFailed} failed.`,
      summary: {
        totalProcessed: results.totalProcessed,
        totalSuccess: results.totalSuccess,
        totalFailed: results.totalFailed,
      },
      results: {
        success: results.success,
        failed: results.failed,
      },
    });
  } catch (error) {
    console.error("Error in bulk import:", error);
    return NextResponse.json(
      {
        error: "Failed to import users",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
