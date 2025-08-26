import { NextRequest, NextResponse } from "next/server";
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
  } catch (error: any) {
    console.error("Error fetching vendor metrics:", error);
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch vendor metrics" },
      { status: 500 }
    );
  }
} 