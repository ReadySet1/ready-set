import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { recordTokenRefresh } from "@/services/notifications/token-refresh";

const registerSchema = z.object({
  token: z.string().min(10),
  userAgent: z.string().optional(),
  platform: z.string().optional(),
});

type RegisterBody = z.infer<typeof registerSchema>;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parseResult = registerSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          errorCode: "VALIDATION_ERROR",
          message: "Invalid push token payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: RegisterBody = parseResult.data;

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
          message: "User must be authenticated to register push notifications.",
        },
        { status: 401 }
      );
    }

    // Use the token refresh service to record this token registration
    // This handles both new tokens and refreshed tokens with proper tracking
    const result = await recordTokenRefresh(
      data.token,
      user.id,
      data.userAgent,
      data.platform
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          errorCode: "TOKEN_REGISTRATION_FAILED",
          message: result.error || "Failed to register push token.",
        },
        { status: 500 }
      );
    }

    // Ensure profile-level preference flag is enabled
    await prisma.profile.update({
      where: { id: user.id },
      data: { hasPushNotifications: true },
    });

    return NextResponse.json({
      success: true,
      isNewToken: result.isNew,
    });
  } catch (error: unknown) {
    console.error("Error registering push token:", error);

    return NextResponse.json(
      {
        success: false,
        errorCode: "INTERNAL_ERROR",
        message: "Failed to register push token.",
      },
      { status: 500 }
    );
  }
}


