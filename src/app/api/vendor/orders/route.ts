import { NextRequest, NextResponse } from "next/server";
import { getVendorOrders, checkVendorAccess, diagnoseDatabaseConnection } from "@/lib/services/vendor";

export async function GET(req: NextRequest) {
  try {
    console.log('Vendor orders API: Starting request processing...');
    
    // Diagnose database connection and auth first
    const diagnosis = await diagnoseDatabaseConnection();
    console.log('Vendor orders API: Diagnosis result:', diagnosis);
    
    // Check if user has vendor access
    const hasAccess = await checkVendorAccess();
    console.log('Vendor orders API: Vendor access check result:', hasAccess);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    // Get limit from query params
    const searchParams = req.nextUrl.searchParams;
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10) || 10) : 10;

    // Get vendor orders
    const orders = await getVendorOrders(limit);
    
    return NextResponse.json(orders);
  } catch (error: any) {
    console.error("Error fetching vendor orders:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      cause: error.cause
    });
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch vendor orders" },
      { status: 500 }
    );
  }
} 