import { NextRequest, NextResponse } from "next/server";
import { checkVendorAccess } from "@/lib/services/vendor";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { prisma as prismaUtilsImport } from "@/utils/prismaDB";
import { PrismaClient } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
        
    // Test 1: Prisma client and database connection
        let prismaTest: any = { success: false, error: 'Unknown error' };
    try {
      const testQuery = await prisma.$queryRaw`SELECT 1 as test`;
      
      // Debug prisma client properties
      const prismaKeys = Object.getOwnPropertyNames(prisma);
      const profileAvailable = 'user' in prisma;
      const cateringRequestAvailable = 'catering_request' in prisma;
      const onDemandAvailable = 'on_demand' in prisma;
      
      // Compare with direct utils import
      const utilsKeys = Object.getOwnPropertyNames(prismaUtilsImport);
      const utilsProfileAvailable = 'user' in prismaUtilsImport;
      const utilsCateringRequestAvailable = 'catering_request' in prismaUtilsImport;
      const utilsOnDemandAvailable = 'on_demand' in prismaUtilsImport;
      
      // Test with fresh client
      const freshClient = new PrismaClient();
      const freshKeys = Object.getOwnPropertyNames(freshClient);
      const freshProfileAvailable = 'user' in freshClient;
      const freshCateringRequestAvailable = 'catering_request' in freshClient;
      const freshOnDemandAvailable = 'on_demand' in freshClient;
      
      prismaTest = { 
        success: true, 
        testQuery, 
        message: 'Prisma client and database connection working correctly',
        debug: {
          prismaKeys: prismaKeys.slice(0, 20), // Show first 20 keys
          profileAvailable,
          cateringRequestAvailable,
          onDemandAvailable,
          prismaType: typeof prisma,
          prismaConstructor: prisma.constructor.name,
          utils: {
            utilsKeys: utilsKeys.slice(0, 20),
            utilsProfileAvailable,
            utilsCateringRequestAvailable,
            utilsOnDemandAvailable,
            utilsType: typeof prismaUtilsImport,
            utilsConstructor: prismaUtilsImport.constructor.name
          },
          fresh: {
            freshKeys: freshKeys.slice(0, 20),
            freshProfileAvailable,
            freshCateringRequestAvailable,
            freshOnDemandAvailable,
            freshType: typeof freshClient,
            freshConstructor: freshClient.constructor.name
          }
        }
      };

      // Note: We intentionally do not disconnect the fresh client here as it should be managed by the singleton pattern
      // Disconnecting within request scope causes "Error: { kind: Closed }" errors

    } catch (error) {
      prismaTest = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
    
    // Test 2: Authentication
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
    
    // Test 3: Vendor access with detailed debugging
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
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      };
    }
    
    // Test 4: Direct profile test with fresh client
        let profileTest: any = { success: false, error: 'Unknown error' };
    try {
      const freshClientForTest = new PrismaClient();
      const profileCount = await freshClientForTest.profile.count();

      // Note: We intentionally do not disconnect the fresh client here as it should be managed by the singleton pattern
      // Disconnecting within request scope causes "Error: { kind: Closed }" errors

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