import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ 
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT_SET",
    supabaseKeyPrefix: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + "..." || "NOT_SET",
    nodeEnv: process.env.NODE_ENV,
    hasEnvLocal: "Checking if .env.local is loaded",
    timestamp: new Date().toISOString()
  });
} 