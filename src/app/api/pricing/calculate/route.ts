import { NextRequest, NextResponse } from 'next/server';
import { PricingService } from '@/services/pricing/pricing.service';
import type { PricingCalculationRequest, PricingApiResponse, PricingCalculation } from '@/types/pricing';

/**
 * POST /api/pricing/calculate
 * Calculate pricing based on head count, food cost, and tip status
 * 
 * ⚠️ WARNING: This endpoint uses the OLD PricingService which is NOT suitable for CaterValley.
 * For CaterValley pricing calculations, use:
 * - POST /api/cater-valley/orders/draft (for order creation)
 * - POST /api/cater-valley/orders/update (for order updates)
 * 
 * This endpoint should only be used for:
 * - Generic pricing previews
 * - Admin tools (non-CaterValley)
 * - Legacy calculator components
 */
export async function POST(request: NextRequest) {
  try {
    const body: PricingCalculationRequest = await request.json();
    const { headCount, foodCost, hasTip } = body;
    
    // Validate required fields
    if (typeof headCount !== 'number' || typeof foodCost !== 'number' || typeof hasTip !== 'boolean') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid required fields: headCount, foodCost, hasTip',
        } as PricingApiResponse,
        { status: 400 }
      );
    }

    // Validate positive values
    if (headCount <= 0 || foodCost <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'headCount and foodCost must be positive numbers',
        } as PricingApiResponse,
        { status: 400 }
      );
    }

    // Calculate pricing using the service
    const pricingService = new PricingService();
    const calculation = await pricingService.calculatePrice(headCount, foodCost, hasTip);

    return NextResponse.json(
      {
        success: true,
        data: calculation,
        message: 'Pricing calculated successfully',
      } as PricingApiResponse<PricingCalculation>,
      { status: 200 }
    );
  } catch (error) {
    console.error('Pricing calculation error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to calculate pricing: ${errorMessage}`,
      } as PricingApiResponse,
      { status: 500 }
    );
  }
}

// Method not allowed for other HTTP methods
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST to calculate pricing.',
    } as PricingApiResponse,
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST to calculate pricing.',
    } as PricingApiResponse,
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST to calculate pricing.',
    } as PricingApiResponse,
    { status: 405 }
  );
} 