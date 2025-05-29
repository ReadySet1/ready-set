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
 * Note: In Next.js 15, params in Edge Runtime can be async
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { slug } = await params;
    
    console.log(`🔥🔥🔥 [API Route] Starting fetch for slug: ${slug}`);
    
    if (!slug || typeof slug !== 'string') {
      console.log(`🔥🔥🔥 [API Route] Invalid slug: ${slug}`);
      return NextResponse.json(
        { 
          error: 'Invalid request', 
          message: 'Guide slug is required and must be a string' 
        },
        { status: 400 }
      );
    }
    
    console.log(`🔥🔥🔥 [API Route] About to call getGuideBySlug`);
    
    // Attempt to fetch the guide
    const guide = await getGuideBySlug(slug);
    
    console.log(`🔥🔥🔥 [API Route] Received guide data:`, {
      id: guide?._id,
      title: guide?.title,
      hasIntroduction: !!guide?.introduction,
      hasMainContent: !!guide?.mainContent,
      hasListSections: !!guide?.listSections,
      rawGuide: guide
    });
    
    // Return 404 if guide not found
    if (!guide) {
      console.log(`🔥🔥🔥 [API Route] No guide found for slug: ${slug}`);
      return NextResponse.json(
        { 
          error: 'Not found',
          message: `Guide with slug "${slug}" not found` 
        },
        { status: 404 }
      );
    }
    
    console.log(`🔥🔥🔥 [API Route] Returning guide data`);
    
    // Return the guide data
    return NextResponse.json({
      data: guide
    });
  } catch (error) {
    // Log the error for debugging
    console.error(`🔥🔥🔥 [API Route] Error fetching guide:`, error);
    
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