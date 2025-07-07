// app/api/dashboard-metrics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { CateringStatus } from '@/types/order-status'

// Define potential Enums if they exist in your schema - These are now imported above
// import { OrderStatus } from '@prisma/client'; // Example if defined

export async function GET() {
  console.log("API Route /api/dashboard-metrics called.");
  try {
    console.log("Fetching dashboard metrics...");
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Use Promise.all for better performance with Supabase
    const [totalRevenueResult, deliveriesRequestsResult, salesTotalResult, totalVendorsResult] =
      await Promise.all([
        // Total revenue from completed orders - corrected column name
        (supabase as any)
          .from('catering_requests')
          .select('orderTotal')
          .eq('status', 'COMPLETED'),
        // Total catering requests
        (supabase as any)
          .from('catering_requests')
          .select('*', { count: 'exact', head: true }),
        // Total completed orders
        (supabase as any)
          .from('catering_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'COMPLETED'),
        // Total vendors
        (supabase as any)
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'VENDOR'),
      ]);
      
    console.log("Supabase queries completed successfully.");
    console.log("Total Revenue Result:", totalRevenueResult);

    // Calculate total revenue from completed orders
    let finalRevenue = 0;
    if (totalRevenueResult.data && totalRevenueResult.data.length > 0) {
      finalRevenue = totalRevenueResult.data.reduce((sum: number, order: any) => {
        const orderTotal = order.orderTotal || 0;
        return sum + (typeof orderTotal === 'string' ? parseFloat(orderTotal) : orderTotal);
      }, 0);
    }
    
    console.log("Processed Revenue Value:", finalRevenue);

    const deliveriesRequests = deliveriesRequestsResult.count || 0;
    const salesTotal = salesTotalResult.count || 0;
    const totalVendors = totalVendorsResult.count || 0;

    const response = {
      totalRevenue: finalRevenue,
      deliveriesRequests,
      salesTotal,
      totalVendors,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // Cache for 5 minutes
      },
    });
  } catch (error: any) {
    console.error("Dashboard metrics error occurred:", error);
    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);
    
    if (error.code) {
       console.error("Prisma Error Code:", error.code);
    }
    
    return NextResponse.json(
      { 
        error: "Failed to fetch dashboard metrics", 
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      }, 
      { status: 500 }
    );
  } finally {
    console.log("API Route /api/dashboard-metrics finished.");
  }
}
