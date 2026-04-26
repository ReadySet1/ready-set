import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/utils/supabase/server";
import { previewCalculations } from "@/lib/google-sheets/drives-pipeline";
import { z } from "zod";

const PreviewRequestSchema = z.object({
  startDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid start date"),
  endDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid end date"),
  forceRecalculate: z.boolean().optional().default(false),
  vendorOverrides: z.record(z.string(), z.string()).optional(),
});

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

    // Check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("type")
      .eq("id", user.id)
      .single();

    const userType = profile?.type?.toLowerCase() || "";
    if (!["admin", "super_admin", "helpdesk"].includes(userType)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = PreviewRequestSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => i.message).join(", ");
      return NextResponse.json(
        { success: false, error: `Validation error: ${errors}` },
        { status: 400 },
      );
    }

    const { startDate, endDate, forceRecalculate, vendorOverrides } = parsed.data;

    const result = await previewCalculations(
      new Date(startDate),
      new Date(endDate),
      forceRecalculate,
      vendorOverrides,
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: "drives-pipeline-preview" },
    });

    const message =
      error instanceof Error ? error.message : "Preview calculation failed";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
