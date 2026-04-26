import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import {
  writeCalculationsToSheet,
  type DriveCalculationResult,
} from "@/lib/google-sheets/drives-pipeline";

const DriveOutputSchema = z.object({
  totalMileage: z.number().finite(),
  mileageRate: z.number().finite(),
  totalMileagePay: z.number().finite(),
  driverTotalBasePay: z.number().finite(),
  bonusVariance: z.number().finite(),
  readySetFee: z.number().finite(),
  readySetAddonFee: z.number().finite(),
  readySetMileageRate: z.number().finite(),
  readySetTotalFee: z.number().finite(),
  toll: z.number().finite(),
  tip: z.number().finite(),
  driverBonusPay: z.number().finite(),
  adjustment: z.number().finite(),
  totalDriverPay: z.number().finite(),
});

const DriveResultSchema = z.object({
  rowIndex: z.number().int().positive(),
  status: z.enum(["calculated", "skipped", "error"]),
  reason: z.string().optional(),
  vendorName: z.string(),
  driverName: z.string(),
  client: z.string(),
  date: z.string(),
  headcount: z.number(),
  foodCost: z.number(),
  configId: z.string().nullable(),
  output: DriveOutputSchema.optional(),
});

const MAX_RESULTS_PER_REQUEST = 5000;

const WriteRequestSchema = z.object({
  results: z
    .array(DriveResultSchema)
    .min(1, "No results to write")
    .max(
      MAX_RESULTS_PER_REQUEST,
      `Too many results (max ${MAX_RESULTS_PER_REQUEST} per request)`,
    ),
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
    const parsed = WriteRequestSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => i.message).join(", ");
      return NextResponse.json(
        { success: false, error: `Validation error: ${errors}` },
        { status: 400 },
      );
    }

    const results: DriveCalculationResult[] = parsed.data.results;

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
