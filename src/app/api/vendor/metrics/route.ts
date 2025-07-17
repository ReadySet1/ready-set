import { NextRequest, NextResponse } from "next/server";
import { getVendorMetrics, checkVendorAccess } from "@/lib/services/vendor";

export async function GET(req: NextRequest) {
  try {
    // Check if user has vendor access
    const hasAccess = await checkVendorAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { 
          error: "Access denied. This area is restricted to authorized vendors only.",
          type: "access_denied"
        },
        { status: 403 }
      );
    }

    // Get vendor metrics
    const metrics = await getVendorMetrics();
    
    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error("Error fetching vendor metrics:", error);
    
    // Handle different types of errors with user-friendly messages
    if (error?.message) {
      // Handle authentication errors
      if (error.message.includes('authenticate') || error.message.includes('unauthorized')) {
        return NextResponse.json(
          { 
            error: "Please sign in to access vendor metrics.",
            type: "auth_error"
          },
          { status: 401 }
        );
      }
      
      // Handle database connection errors
      if (error.message.includes('connect') || error.message.includes('timeout')) {
        return NextResponse.json(
          { 
            error: "We're experiencing technical difficulties. Please try again in a moment.",
            type: "connection_error"
          },
          { status: 503 }
        );
      }
    }
    
    // Generic error fallback
    return NextResponse.json(
      { 
        error: "Unable to load vendor metrics. Please try again or contact support if the problem persists.",
        type: "server_error"
      },
      { status: 500 }
    );
  }
} 