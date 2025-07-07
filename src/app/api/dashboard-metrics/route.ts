// app/api/dashboard-metrics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { CateringStatus } from '@/types/order-status'
import { prisma } from '@/utils/prismaDB'

// Define potential Enums if they exist in your schema - These are now imported above
// import { OrderStatus } from '@prisma/client'; // Example if defined

export async function GET() {
  console.log("API Route /api/dashboard-metrics called.");
  try {
    console.log("Fetching dashboard metrics...");
    
    // Use Promise.all for better performance
    const [totalRevenue, deliveriesRequests, salesTotal, totalVendors] =
      await Promise.all([
        prisma.cateringRequest.aggregate({
          _sum: {
            orderTotal: true,
          },
          where: {
            deletedAt: null,
            // Only include completed orders for revenue calculation
            status: CateringStatus.COMPLETED,
          },
        }),
        prisma.cateringRequest.count({
          where: {
            deletedAt: null,
          },
        }),
        prisma.cateringRequest.count({
          where: {
            deletedAt: null,
            status: CateringStatus.COMPLETED,
          },
        }),
        prisma.profile.count({
          where: {
            deletedAt: null,
            type: "VENDOR",
          },
        }),
      ]);
      
    console.log("Prisma queries completed successfully.");
    console.log("Total Revenue Result:", totalRevenue);

    const revenueValue = totalRevenue._sum.orderTotal;
    console.log("Raw Revenue Value:", revenueValue);

    // Properly handle Decimal type from Prisma
    let finalRevenue = 0;
    if (revenueValue !== null && revenueValue !== undefined) {
      if (revenueValue instanceof Decimal) {
        finalRevenue = revenueValue.toNumber();
      } else if (typeof revenueValue === 'string') {
        // Handle case where Decimal might be serialized as string
        finalRevenue = parseFloat(revenueValue);
      } else if (typeof revenueValue === 'number') {
        finalRevenue = revenueValue;
      } else {
        console.warn("Unexpected revenue value type:", typeof revenueValue, revenueValue);
        finalRevenue = 0;
      }
    }
    
    console.log("Processed Revenue Value:", finalRevenue);

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
