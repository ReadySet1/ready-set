import { NextRequest, NextResponse } from "next/server";
import { getUserOrders, checkOrderAccess } from "@/lib/services/vendor";

export async function GET(req: NextRequest) {
  try {
    // Check if user has access to view orders
    const hasAccess = await checkOrderAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    // Get limit from query params
    const searchParams = req.nextUrl.searchParams;
    const parsedPage = parseInt(searchParams.get("page") || "", 10);
    const parsedLimit = parseInt(searchParams.get("limit") || "", 10);
    const page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 10 : parsedLimit;

    // Get user orders
    const result = await getUserOrders(limit, page);
    
    return NextResponse.json({
      orders: result.orders,
      hasMore: result.hasMore,
      total: result.total,
      page,
      limit
    });
  } catch (error: any) {
    console.error("Error fetching vendor orders:", error);
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch vendor orders" },
      { status: 500 }
    );
  }
} 