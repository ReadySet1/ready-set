import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { validateToken } from "@/services/notifications/token-refresh";

const validateSchema = z.object({
  token: z.string().min(10),
});

/**
 * POST /api/notifications/push/validate
 *
 * Validates a push notification token with Firebase.
 * Returns whether the token is valid and can receive notifications.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parseResult = validateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          errorCode: "VALIDATION_ERROR",
          message: "Invalid request payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { token } = parseResult.data;

    // Require authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          errorCode: "UNAUTHENTICATED",
          message: "User must be authenticated to validate tokens.",
        },
        { status: 401 }
      );
    }

    // Validate the token with Firebase
    const result = await validateToken(token);

    return NextResponse.json({
      success: true,
      valid: result.valid,
      error: result.error,
    });
  } catch (error: unknown) {
    Sentry.captureException(error, {
      tags: { route: "notifications/push/validate" },
    });

    return NextResponse.json(
      {
        success: false,
        errorCode: "INTERNAL_ERROR",
        message: "Failed to validate push token.",
      },
      { status: 500 }
    );
  }
}
