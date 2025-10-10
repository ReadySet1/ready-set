import { NextRequest, NextResponse } from 'next/server';
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Get user session from Supabase
    const { data: { user } } = await supabase.auth.getUser();

    // Check if user is authenticated
    if (!user || !user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const allowedCounties = await fetchAllowedCountiesForUser(userId);
    return NextResponse.json({ counties: allowedCounties });
  } catch (error) {
    console.error('Error fetching allowed counties:', error);
    return NextResponse.json({ error: 'Failed to fetch allowed counties' }, { status: 500 });
  }
}

/**
 * Returns the list of allowed counties for a user.
 * Currently returns all available Bay Area counties.
 * Can be extended to filter based on user profile's countiesServed field.
 */
async function fetchAllowedCountiesForUser(userId: string): Promise<string[]> {
  // Return all available Bay Area counties including San Francisco and Santa Clara
  return [
    'Alameda',
    'Contra Costa',
    'San Francisco',
    'San Mateo',
    'Santa Clara'
  ];
}