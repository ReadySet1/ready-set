import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getUserOrderMetrics, checkOrderAccess } from "@/lib/services/vendor";

export async function GET(req: NextRequest) {
  try {
    // Check if user has access to view orders
    const hasAccess = await checkOrderAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 400 }
      );
    }

    // Get user order metrics
    const metrics = await getUserOrderMetrics();

    return NextResponse.json(metrics);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: "order-metrics" },
    });

    const errorMessage =
      error instanceof Error && error.message
        ? error.message
        : "Failed to fetch vendor metrics";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 