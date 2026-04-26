import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  runSmsReminderBatch,
  type ReminderType,
} from "@/services/sms-reminders";
import { authorizeSmsAdmin } from "../_auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    const isValidCronRequest =
      !!cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (process.env.NODE_ENV === "production" && !cronSecret) {
      Sentry.captureMessage(
        "CRON_SECRET not set in production — refusing SMS reminder cron",
        "error",
      );
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 },
      );
    }

    if (!isValidCronRequest) {
      const auth = await authorizeSmsAdmin(true);
      if (!auth.authorized) {
        return NextResponse.json(
          {
            error:
              "Unauthorized - admin access or valid cron secret required",
          },
          { status: 401 },
        );
      }
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
