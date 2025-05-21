import { NextRequest, NextResponse } from 'next/server';
import { getGuideBySlug } from '@/sanity/lib/queries';
import { initializeEdgeMonitoring } from '@/lib/monitoring';

// Set edge runtime for better performance
export const runtime = 'edge';

// Initialize edge-compatible monitoring
initializeEdgeMonitoring();

// Define types compatible with Next.js 15 Edge Runtime
type RouteParams = {
  slug: string;
};

/**
 * Edge API route to fetch a guide by slug
 * Note: There is a known TypeScript error with Edge Runtime + dynamic params
 * See EDGE_RUNTIME_TYPESCRIPT_NOTES.md for details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { slug } = params;
    
    if (!slug || typeof slug !== 'string') {
      return NextResponse.json(
        { 
          error: 'Invalid request', 
          message: 'Guide slug is required and must be a string' 
        },
        { status: 400 }
      );
    }
    
    // Attempt to fetch the guide
    const guide = await getGuideBySlug(slug);
    
    // Return 404 if guide not found
    if (!guide) {
      return NextResponse.json(
        { 
          error: 'Not found',
          message: `Guide with slug "${slug}" not found` 
        },
        { status: 404 }
      );
    }
    
    // Return the guide data
    return NextResponse.json({
      data: guide
    });
  } catch (error) {
    // Log the error for debugging
    console.error(`Error fetching guide with slug ${params?.slug}:`, error);
    
    // Return appropriate error response
    return NextResponse.json(
      { 
        error: 'Server error',
        message: 'Failed to fetch guide data'
      },
      { status: 500 }
    );
  }
} 