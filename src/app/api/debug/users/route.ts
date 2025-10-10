import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    
    console.log("🔍 Testing Supabase connection...");
    
    // Test the profiles table with different column combinations
    const tests = [
      { name: "profiles with email,type", query: "email, type" },
      { name: "profiles with email,role", query: "email, role" },
      { name: "profiles with *", query: "*" }
    ];
    
    const results: any = {};
    
    for (const test of tests) {
      try {
        console.log(`🔍 Testing: ${test.name}`);
        const { data, error } = await supabase
          .from("profiles")
          .select(test.query)
          .limit(5);
          
        results[test.name] = {
          success: !error,
          error: error?.message,
          count: data?.length || 0,
          sample: data?.slice(0, 2) || []
        };
        
        console.log(`📊 ${test.name}: ${error ? `ERROR - ${error.message}` : `SUCCESS - ${data?.length || 0} records`}`);
        
        // If this test was successful and found data, break
        if (!error && data && data.length > 0) {
          console.log("✅ Found working query:", test.name);
          break;
        }
        
      } catch (err) {
        results[test.name] = {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
          count: 0,
          sample: []
        };
      }
    }

    return NextResponse.json({ 
      success: true,
      connection: "SUCCESS",
      tests: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Server error:", error);
    return NextResponse.json({ 
      error: "Server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
} 