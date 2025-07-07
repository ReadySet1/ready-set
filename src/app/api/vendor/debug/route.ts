import { NextRequest, NextResponse } from "next/server";
import { diagnoseDatabaseConnection, checkVendorAccess } from "@/lib/services/vendor";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Vendor Debug API: Starting comprehensive diagnosis...');
    
    // Test 1: Database connection
    console.log('🔍 Test 1: Database connection...');
    const dbTest = await diagnoseDatabaseConnection();
    console.log('🔍 Database test result:', dbTest);
    
    // Test 2: Prisma client
    console.log('🔍 Test 2: Prisma client direct test...');
    let prismaTest: any = { success: false, error: 'Unknown error' };
    try {
      const testQuery = await prisma.$queryRaw`SELECT 1 as test`;
      // Note: profile table may not exist in the schema, using a safer test
      prismaTest = { 
        success: true, 
        testQuery, 
        message: 'Prisma client working correctly'
      };
    } catch (error) {
      prismaTest = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
    
    // Test 3: Authentication
    console.log('🔍 Test 3: Authentication test...');
    let authTest: any = { success: false, error: 'Unknown error' };
    try {
      const user = await getCurrentUser();
      authTest = {
        success: !!user,
        user: user ? { id: user.id, email: user.email } : null,
        message: user ? 'User authenticated' : 'No user authenticated'
      };
    } catch (error) {
      authTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    
    // Test 4: Vendor access
    console.log('🔍 Test 4: Vendor access test...');
    let vendorTest: any = { success: false, error: 'Unknown error' };
    try {
      const hasAccess = await checkVendorAccess();
      vendorTest = {
        success: hasAccess,
        message: hasAccess ? 'Vendor access granted' : 'Vendor access denied'
      };
    } catch (error) {
      vendorTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    
    // Test 5: Environment variables
    console.log('🔍 Test 5: Environment variables...');
    const envTest = {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_RUNTIME: process.env.NEXT_RUNTIME,
      hasDataBaseUrl: !!process.env.DATABASE_URL,
      databaseUrlPreview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'NOT SET'
    };
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: 'Debug information collected',
      tests: {
        database: dbTest,
        prisma: prismaTest,
        authentication: authTest,
        vendorAccess: vendorTest,
        environment: envTest
      }
    });
    
  } catch (error: any) {
    console.error("🔍 Debug API Error:", error);
    return NextResponse.json(
      { 
        error: error.message || "Failed to run debug tests",
        timestamp: new Date().toISOString(),
        status: 'Error during diagnosis'
      },
      { status: 500 }
    );
  }
} 