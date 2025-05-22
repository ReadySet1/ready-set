// app/api/dashboard-metrics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { PrismaClient, Prisma } from '@prisma/client'
import { Decimal } from '@/types/prisma'
import { CateringStatus } from '@/types/order-status'

const prisma = new PrismaClient();

// Define potential Enums if they exist in your schema - These are now imported above
// import { OrderStatus } from '@prisma/client'; // Example if defined

export async function GET() {
  console.log("API Route /api/dashboard-metrics called."); // Log route entry
  try {
    // It's often better to perform these sequentially if one depends on another
    // or if you want finer-grained error handling. Promise.all is fine for independent queries.
    
    console.log("Fetching total revenue...");
    const totalRevenuePromise = prisma.cateringRequest.aggregate({
      _sum: {
        orderTotal: true, // orderTotal is Decimal, Prisma handles sum
      },
    });

    console.log("Fetching total delivery requests count...");
    const deliveriesRequestsPromise = prisma.cateringRequest.count();

    console.log("Fetching completed sales count...");
    const salesTotalPromise = prisma.cateringRequest.count({
      where: {
        // Use the imported CateringStatus enum
        status: CateringStatus.COMPLETED, 
      },
    });

    console.log("Fetching total vendors count...");
    const totalVendorsPromise = prisma.profile.count({
      where: {
        // Use string directly for vendor type
        type: "VENDOR", 
      },
    });

    const [totalRevenue, deliveriesRequests, salesTotal, totalVendors] =
      await Promise.all([
        totalRevenuePromise,
        deliveriesRequestsPromise,
        salesTotalPromise,
        totalVendorsPromise,
      ]);
      
    console.log("Prisma queries completed successfully.");
    console.log("Total Revenue Result:", totalRevenue);
    console.log("Deliveries Requests Count:", deliveriesRequests);
    console.log("Sales Total Count:", salesTotal);
    console.log("Total Vendors Count:", totalVendors);

    const revenueValue = totalRevenue._sum.orderTotal; // This should be Prisma.Decimal | null
    console.log("Raw Revenue Value:", revenueValue ? revenueValue.toString() : 'null'); // Log it safely

    // Handle potential Decimal type from Prisma before converting
    let finalRevenue = 0;
    if (revenueValue && typeof revenueValue.toNumber === 'function') {
      // It's a Prisma.Decimal-like object
      finalRevenue = revenueValue.toNumber();
    } else if (typeof revenueValue === 'number') {
      // This case should ideally not happen if schema type is Decimal
      finalRevenue = revenueValue;
    } else if (revenueValue === null) {
      finalRevenue = 0;
    } else if (revenueValue !== undefined) {
      // Fallback for unexpected types, try to parse if it's a string number
      const parsed = parseFloat(revenueValue as any);
      if (!isNaN(parsed)) {
        finalRevenue = parsed;
        console.warn(`Revenue value was an unexpected type but parsed: ${typeof revenueValue}, value: ${revenueValue}`);
      } else {
        console.error(`Revenue value is of an unexpected type and could not be parsed: ${typeof revenueValue}, value: ${revenueValue}`);
      }
    }
    // If revenueValue is undefined, finalRevenue remains 0, which is fine.
    
    console.log("Processed Revenue Value:", finalRevenue);

    return NextResponse.json({
      totalRevenue: finalRevenue,
      deliveriesRequests,
      salesTotal,
      totalVendors,
    });
  } catch (error: any) {
    // Log the specific error object
    console.error("Dashboard metrics error occurred:", error);
    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);
    console.error("Error Stack:", error.stack);
    // If it's a Prisma error, it might have a 'code' property
    if (error.code) {
       console.error("Prisma Error Code:", error.code);
    }
    return NextResponse.json(
      { error: "Failed to fetch dashboard metrics", details: error.message }, 
      { status: 500 }
    );
  } finally {
    // Optional: Disconnect Prisma client if not using long-running connections
    // await prisma.$disconnect(); 
    // Be cautious with this in serverless environments or frequent requests.
    console.log("API Route /api/dashboard-metrics finished."); // Log route exit
  }
}
