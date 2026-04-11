import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/utils/supabase/server";
import {
  runSmsReminderBatch,
  type ReminderType,
} from "@/services/sms-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface AppMetadata {
  role?: string;
}

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV === "production" && !cronSecret) {
      Sentry.captureMessage(
        "CRON_SECRET not set in production - SMS reminder cron requires authentication",
        "warning",
      );
    }

    const authHeader = request.headers.get("authorization");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isValidCronRequest =
      cronSecret && authHeader === `Bearer ${cronSecret}`;
    const role = (user?.app_metadata as AppMetadata)?.role;
    const isAdminUser = user && (role === "admin" || role === "super_admin");
    const isAuthorized = isValidCronRequest || isAdminUser;

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized - admin access or valid cron secret required" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as ReminderType | null;

    if (!type || (type !== "next_day" && type !== "same_day")) {
      return NextResponse.json(
        { error: 'Missing or invalid type param. Use "next_day" or "same_day"' },
        { status: 400 },
      );
    }

    // Compute target date: next_day -> tomorrow, same_day -> today
    const now = new Date();
    const targetDate = new Date(now);
    if (type === "next_day") {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    // Reset time to midnight
    targetDate.setHours(0, 0, 0, 0);

    const result = await runSmsReminderBatch(type, targetDate, "cron");

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("SMS cron error:", error);
    Sentry.captureException(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "SMS reminder cron job failed",
      },
      { status: 500 },
    );
  }
}
