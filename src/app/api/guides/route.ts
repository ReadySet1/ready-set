import { NextRequest, NextResponse } from 'next/server';
import { getGuides } from '@/sanity/lib/queries';
import { initializeEdgeMonitoring } from '@/lib/monitoring';

// Set edge runtime for better performance
export const runtime = 'edge';

// Initialize edge-compatible monitoring
initializeEdgeMonitoring();

/**
 * Edge API route to fetch all guides
 */
export async function GET(request: NextRequest) {
  try {
    // Fetch all guides
    const guides = await getGuides();
    
    // Return guides in a consistent format
    const response = NextResponse.json({
      data: guides
    });
    response.headers.set('Cache-Control', 'private, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    // Log error for debugging
    console.error('Error fetching guides:', error);
    
    // Return appropriate error response
    return NextResponse.json(
      { 
        error: 'Server error',
        message: 'Failed to fetch guides data'
      },
      { status: 500 }
    );
  }
} 