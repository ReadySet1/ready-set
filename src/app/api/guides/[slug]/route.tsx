import { NextRequest, NextResponse } from 'next/server';
import { getGuideBySlug } from '@/sanity/lib/queries';
import { initializeEdgeMonitoring } from '@/lib/monitoring';

// Set edge runtime for better performance
export const runtime = 'edge';

// Initialize edge-compatible monitoring
initializeEdgeMonitoring();

export async function GET(
  request: NextRequest,
  context: { params: { slug: string } }
) {
  try {
    // Extract the slug from the context params
    const slug = context.params.slug;
    
    if (!slug) {
      return NextResponse.json(
        { error: 'Guide slug is required' },
        { status: 400 }
      );
    }
    
    const guide = await getGuideBySlug(slug);
    
    if (!guide) {
      return NextResponse.json(
        { error: 'Guide not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(guide);
  } catch (error) {
    console.error('Error fetching guide:', error);
    return NextResponse.json(
      { error: 'Failed to fetch guide' },
      { status: 500 }
    );
  }
} 