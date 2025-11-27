import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trackNotificationClickByMessageId } from "@/services/notifications/analytics";

const clickSchema = z.object({
  fcmMessageId: z.string().min(1).optional(),
  orderId: z.string().uuid().optional(),
  notificationId: z.string().uuid().optional(),
});

/**
 * POST /api/notifications/push/click
 *
 * Records a notification click event for analytics.
 * Called from the service worker when a user clicks on a notification.
 *
 * This endpoint does NOT require authentication since it's called
 * from the service worker before the user is authenticated in the app.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parseResult = clickSchema.safeParse(body);

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

    const { fcmMessageId, notificationId } = parseResult.data;

    // Track the click based on what identifier we have
    if (fcmMessageId) {
      await trackNotificationClickByMessageId(fcmMessageId);
    } else if (notificationId) {
      // Direct notification ID lookup
      const { markNotificationClicked } = await import(
        "@/services/notifications/analytics"
      );
      await markNotificationClicked(notificationId);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    Sentry.captureException(error, {
      tags: { route: "notifications/push/click" },
    });

    // Don't fail the request on analytics errors
    // The user experience shouldn't be affected by tracking issues
    return NextResponse.json({ success: true });
  }
}
