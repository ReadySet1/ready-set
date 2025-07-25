import { NextRequest, NextResponse } from "next/server";
import { getVendorOrders, checkVendorAccess } from "@/lib/services/vendor";

export async function GET(req: NextRequest) {
  try {
    // Check if user has vendor access
    const hasAccess = await checkVendorAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    // Get limit from query params
    const searchParams = req.nextUrl.searchParams;
    const page = searchParams.get("page") 
      ? parseInt(searchParams.get("page") as string, 10) 
      : 1;
    const limit = searchParams.get("limit") 
      ? parseInt(searchParams.get("limit") as string, 10) 
      : 10;

    // Get vendor orders
    const result = await getVendorOrders(limit, page);
    
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