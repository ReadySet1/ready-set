import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/utils/supabase/server";
import {
  writeCalculationsToSheet,
  type DriveCalculationResult,
} from "@/lib/google-sheets/drives-pipeline";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Restrict write to admin/super_admin only (not helpdesk)
    const { data: profile } = await supabase
      .from("profiles")
      .select("type")
      .eq("id", user.id)
      .single();

    const userType = profile?.type?.toLowerCase() || "";
    if (!["admin", "super_admin"].includes(userType)) {
      return NextResponse.json(
        { success: false, error: "Forbidden — write access requires admin role" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const results: DriveCalculationResult[] = body.results;

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { success: false, error: "No results to write" },
        { status: 400 },
      );
    }

    const writeResult = await writeCalculationsToSheet(results);

    return NextResponse.json({ success: true, data: writeResult });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: "drives-pipeline-write" },
    });

    const message =
      error instanceof Error ? error.message : "Write to sheet failed";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
