import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { UserType } from "@/types/prisma";
import { userBulkOperationsService } from "@/services/userBulkOperationsService";
import type { BulkEmailRequest } from "@/types/bulk-operations";

const VALID_TEMPLATES = ["announcement", "promotion", "survey", "custom"] as const;

/**
 * POST /api/users/bulk/email
 * Send email to multiple users
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

    // Parse request body
    const body = await request.json();
    const { userIds, template, subject, body: emailBody, reason } = body;

    // Validate request
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate template
    if (!template || !VALID_TEMPLATES.includes(template)) {
      return NextResponse.json(
        {
          error: `Invalid template. Must be one of: ${VALID_TEMPLATES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate subject
    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      return NextResponse.json(
        { error: "Subject is required" },
        { status: 400 }
      );
    }

    if (subject.length > 200) {
      return NextResponse.json(
        { error: "Subject must be 200 characters or less" },
        { status: 400 }
      );
    }

    // Validate body
    if (!emailBody || typeof emailBody !== "string" || emailBody.trim().length === 0) {
      return NextResponse.json(
        { error: "Email body is required" },
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

    // Perform bulk email
    const emailRequest: BulkEmailRequest = {
      userIds,
      template,
      subject: subject.trim(),
      body: emailBody.trim(),
      reason,
    };

    const results = await userBulkOperationsService.bulkSendEmail(
      emailRequest,
      user.id
    );

    return NextResponse.json({
      message: `Email sent to ${results.totalSuccess} users. ${results.totalFailed} failed.`,
      results,
    });
  } catch (error) {
    console.error("Error in bulk email:", error);
    return NextResponse.json(
      {
        error: "Failed to send bulk email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
