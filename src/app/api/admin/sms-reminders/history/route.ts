import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeSmsAdmin } from "../_auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeSmsAdmin();
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: auth.status },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
    );
    const skip = (page - 1) * limit;

    const [batches, total] = await Promise.all([
      prisma.smsReminderBatch.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          logs: {
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.smsReminderBatch.count(),
    ]);

    return NextResponse.json({
      batches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("SMS history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 },
    );
  }
}
