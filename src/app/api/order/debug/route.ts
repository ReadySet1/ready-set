import { NextRequest, NextResponse } from "next/server";
import { checkVendorAccess } from "@/lib/services/vendor";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    // Test 1: Prisma client and database connection
    let prismaTest: { success: boolean; testQuery?: unknown; message?: string; error?: string } = { success: false, error: 'Unknown error' };
    try {
      const testQuery = await prisma.$queryRaw`SELECT 1 as test`;
      prismaTest = {
        success: true,
        testQuery,
        message: 'Prisma client and database connection working correctly'
      };
    } catch (error) {
      prismaTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    
    // Test 2: Authentication
    let authTest: { success: boolean; user?: { id: string; email?: string } | null; message?: string; error?: string } = { success: false, error: 'Unknown error' };
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
    
    // Test 3: Vendor access
    let vendorTest: { success: boolean; message?: string; error?: string; stack?: string } = { success: false, error: 'Unknown error' };
    try {
      const hasAccess = await checkVendorAccess();
      vendorTest = {
        success: hasAccess,
        message: hasAccess ? 'Vendor access granted' : 'Vendor access denied'
      };
    } catch (error) {
      vendorTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      };
    }
    
    // Test 4: Profile count test
    let profileTest: { success: boolean; profileCount?: number; message?: string; error?: string } = { success: false, error: 'Unknown error' };
    try {
      const profileCount = await prisma.profile.count();
      profileTest = {
        success: true,
        profileCount,
        message: `Found ${profileCount} profiles in database`
      };
    } catch (error) {
      profileTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    
    // Test 5: Environment variables
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
        prisma: prismaTest,
        authentication: authTest,
        vendorAccess: vendorTest,
        profileTest: profileTest,
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