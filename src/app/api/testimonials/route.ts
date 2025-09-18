import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export interface TestimonialResponse {
  id: string;
  name: string;
  role: string | null;
  content: string;
  image: string | null;
  rating: number;
  category: 'CLIENTS' | 'VENDORS' | 'DRIVERS';
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/testimonials
 * Fetches testimonials from the database
 * 
 * Query parameters:
 * - category: Filter by category (CLIENTS, VENDORS, DRIVERS) - optional
 * - active: Filter by active status (true/false) - defaults to true
 * - limit: Limit number of results - optional
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const category = searchParams.get('category');
    const activeParam = searchParams.get('active');
    const limitParam = searchParams.get('limit');
    
    // Parse parameters
    const active = activeParam !== null ? activeParam === 'true' : true;
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    
    // Build query
    let query = supabase
      .from('testimonials')
      .select('*')
      .eq('is_active', active)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    
    // Add category filter if specified
    if (category && ['CLIENTS', 'VENDORS', 'DRIVERS'].includes(category)) {
      query = query.eq('category', category);
    }
    
    // Add limit if specified
    if (limit && limit > 0) {
      query = query.limit(limit);
    }
    
    const { data: testimonials, error } = await query;
    
    if (error) {
      console.error('Error fetching testimonials:', error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch testimonials', 
          details: error.message 
        }, 
        { status: 500 }
      );
    }
    
    // Transform data to match expected format
    const formattedTestimonials: TestimonialResponse[] = (testimonials || []).map(testimonial => ({
      id: testimonial.id,
      name: testimonial.name,
      role: testimonial.role,
      content: testimonial.content,
      image: testimonial.image,
      rating: testimonial.rating,
      category: testimonial.category as 'CLIENTS' | 'VENDORS' | 'DRIVERS',
      isActive: testimonial.is_active,
      sortOrder: testimonial.sort_order,
      createdAt: testimonial.created_at,
      updatedAt: testimonial.updated_at,
    }));
    
    return NextResponse.json({
      success: true,
      count: formattedTestimonials.length,
      testimonials: formattedTestimonials,
    });
    
  } catch (error) {
    console.error('Unexpected error in testimonials API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
}

/**
 * POST /api/testimonials
 * Creates a new testimonial (for admin use)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    // Validate required fields
    const { name, content, category = 'CLIENTS' } = body;
    
    if (!name || !content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      );
    }
    
    if (!['CLIENTS', 'VENDORS', 'DRIVERS'].includes(category)) {
      return NextResponse.json(
        { error: 'Category must be CLIENTS, VENDORS, or DRIVERS' },
        { status: 400 }
      );
    }
    
    const testimonialData = {
      name,
      role: body.role || null,
      content,
      image: body.image || null,
      rating: body.rating || 5,
      category,
      is_active: body.isActive !== undefined ? body.isActive : true,
      sort_order: body.sortOrder || 0,
    };
    
    const { data: testimonial, error } = await supabase
      .from('testimonials')
      .insert([testimonialData])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating testimonial:', error);
      return NextResponse.json(
        { 
          error: 'Failed to create testimonial', 
          details: error.message 
        }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      testimonial: {
        id: testimonial.id,
        name: testimonial.name,
        role: testimonial.role,
        content: testimonial.content,
        image: testimonial.image,
        rating: testimonial.rating,
        category: testimonial.category,
        isActive: testimonial.is_active,
        sortOrder: testimonial.sort_order,
        createdAt: testimonial.created_at,
        updatedAt: testimonial.updated_at,
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error('Unexpected error creating testimonial:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
}
