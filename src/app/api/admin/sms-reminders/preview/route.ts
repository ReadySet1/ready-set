import { NextRequest, NextResponse } from "next/server";
import {
  previewSmsReminderBatch,
  type ReminderType,
} from "@/services/sms-reminders";
import { authorizeSmsAdmin } from "../_auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeSmsAdmin();
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: auth.status },
      );
    }

    const body = (await request.json()) as {
      type?: string;
      targetDate?: string;
      helpdeskAgent?: string;
    };

    const { type, targetDate, helpdeskAgent } = body;

    if (!type || !targetDate) {
      return NextResponse.json(
        { error: "Missing required fields: type, targetDate" },
        { status: 400 },
      );
    }

    if (type !== "next_day" && type !== "same_day") {
      return NextResponse.json(
        { error: 'Invalid type. Must be "next_day" or "same_day"' },
        { status: 400 },
      );
    }

    const date = new Date(targetDate + "T00:00:00");
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const preview = await previewSmsReminderBatch(
      type as ReminderType,
      date,
      helpdeskAgent,
    );

    return NextResponse.json({ preview });
  } catch (error) {
    console.error("SMS preview error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate preview",
      },
      { status: 500 },
    );
  }
}
