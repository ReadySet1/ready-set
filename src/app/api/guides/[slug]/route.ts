import { NextRequest, NextResponse } from 'next/server';
import { getGuideBySlug } from '@/sanity/lib/queries';

// Define types compatible with Next.js 15
type RouteParams = {
  slug: string;
};

/**
 * API route to fetch a guide by slug
 * Note: This route is kept for compatibility but not actively used
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { slug } = await params;
    
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