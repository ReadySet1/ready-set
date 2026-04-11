import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const role = (user?.app_metadata as AppMetadata)?.role;
    if (!user || (role !== "admin" && role !== "super_admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      type?: string;
      targetDate?: string;
      helpdeskAgent?: string;
      drivers?: string[];
    };

    const { type, targetDate, helpdeskAgent, drivers } = body;

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

    const result = await runSmsReminderBatch(
      type as ReminderType,
      date,
      user.email ?? "admin",
      helpdeskAgent,
      drivers,
    );

    return NextResponse.json({ result });
  } catch (error) {
    console.error("SMS send error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send reminders",
      },
      { status: 500 },
    );
  }
}
