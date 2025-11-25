import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/db/prisma";

const preferencesSchema = z.object({
  hasPushNotifications: z.boolean().optional(),
});

type PreferencesBody = z.infer<typeof preferencesSchema>;

async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          errorCode: "UNAUTHENTICATED",
          message: "User must be authenticated to view push preferences.",
        },
        { status: 401 }
      );
    }

    const [profile, tokens] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: userId },
        select: {
          hasPushNotifications: true,
        },
      }),
      prisma.profilePushToken.findMany({
        where: { profileId: userId, revokedAt: null },
        select: {
          id: true,
          platform: true,
          userAgent: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      hasPushNotifications: profile?.hasPushNotifications ?? false,
      devices: tokens.map((token) => ({
        id: token.id,
        platform: token.platform,
        userAgent: token.userAgent,
        createdAt: token.createdAt,
      })),
    });
  } catch (error: unknown) {
    console.error("Error fetching push preferences:", error);

    return NextResponse.json(
      {
        success: false,
        errorCode: "INTERNAL_ERROR",
        message: "Failed to fetch push preferences.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          errorCode: "UNAUTHENTICATED",
          message: "User must be authenticated to update push preferences.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parseResult = preferencesSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          errorCode: "VALIDATION_ERROR",
          message: "Invalid push preferences payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data: PreferencesBody = parseResult.data;

    if (typeof data.hasPushNotifications === "boolean") {
      await prisma.profile.update({
        where: { id: userId },
        data: {
          hasPushNotifications: data.hasPushNotifications,
        },
      });

      // If user disables push globally, revoke all active tokens for this profile
      if (!data.hasPushNotifications) {
        await prisma.profilePushToken.updateMany({
          where: { profileId: userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error updating push preferences:", error);

    return NextResponse.json(
      {
        success: false,
        errorCode: "INTERNAL_ERROR",
        message: "Failed to update push preferences.",
      },
      { status: 500 }
    );
  }
}


