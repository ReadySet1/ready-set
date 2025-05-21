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
    return NextResponse.json({
      data: guides
    });
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