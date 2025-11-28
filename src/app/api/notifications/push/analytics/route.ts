import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/db/prisma";
import {
  getNotificationMetrics,
  getMetricsByRecipientType,
  getMetricsByEventType,
  getRecentFailedNotifications,
} from "@/services/notifications/analytics";
import { getSystemTokenStats } from "@/services/notifications/token-refresh";

/**
 * GET /api/notifications/push/analytics
 *
 * Returns push notification analytics and metrics.
 * Admin-only endpoint.
 *
 * Query params:
 * - days: Number of days to look back (default: 7)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
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
          message: "User must be authenticated.",
        },
        { status: 401 }
      );
    }

    // Check for admin role
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true },
    });

    const adminRoles = ["ADMIN", "SUPER_ADMIN", "HELPDESK"];
    if (!profile || !adminRoles.includes(profile.type)) {
      return NextResponse.json(
        {
          success: false,
          errorCode: "FORBIDDEN",
          message: "Admin access required.",
        },
        { status: 403 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "7", 10);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Fetch all analytics data in parallel
    const [
      overallMetrics,
      metricsByRecipient,
      metricsByEvent,
      recentFailures,
      tokenStats,
    ] = await Promise.all([
      getNotificationMetrics(startDate, endDate),
      getMetricsByRecipientType(startDate, endDate),
      getMetricsByEventType(startDate, endDate),
      getRecentFailedNotifications(10),
      getSystemTokenStats(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          days,
        },
        overall: overallMetrics,
        byRecipientType: metricsByRecipient,
        byEventType: metricsByEvent,
        recentFailures: recentFailures.map((f) => ({
          id: f.id,
          event: f.event,
          recipientType: f.recipientType,
          errorMessage: f.errorMessage,
          createdAt: f.createdAt,
        })),
        tokens: tokenStats,
      },
    });
  } catch (error: unknown) {
    Sentry.captureException(error, {
      tags: { route: "notifications/push/analytics" },
    });

    return NextResponse.json(
      {
        success: false,
        errorCode: "INTERNAL_ERROR",
        message: "Failed to fetch analytics.",
      },
      { status: 500 }
    );
  }
}
