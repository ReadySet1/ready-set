import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/db/prisma";

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

    // Upsert token for this profile. We keep a single active row per (profile, token)
    await prisma.profilePushToken.upsert({
      where: {
        // Compound uniqueness is not enforced by the DB, but we simulate it via token uniqueness
        token: data.token,
      },
      create: {
        profileId: user.id,
        token: data.token,
        userAgent: data.userAgent,
        platform: data.platform,
      },
      update: {
        profileId: user.id,
        userAgent: data.userAgent,
        platform: data.platform,
        revokedAt: null,
      },
    });

    // Ensure profile-level preference flag is enabled
    await prisma.profile.update({
      where: { id: user.id },
      data: { hasPushNotifications: true },
    });

    return NextResponse.json({ success: true });
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


