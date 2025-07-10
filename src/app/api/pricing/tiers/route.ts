import { NextRequest, NextResponse } from 'next/server';
import { PricingService } from '@/services/pricing/pricing.service';
import type { PricingTier, PricingTierCreateInput, PricingApiResponse } from '@/types/pricing';

/**
 * GET /api/pricing/tiers
 * Fetch all active pricing tiers
 */
export async function GET() {
  try {
    const pricingService = new PricingService();
    const tiers = await pricingService.getAllTiers();
    
    return NextResponse.json(
      {
        success: true,
        data: tiers,
        message: 'Pricing tiers fetched successfully',
      } as PricingApiResponse<PricingTier[]>,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching pricing tiers:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch pricing tiers: ${errorMessage}`,
      } as PricingApiResponse,
      { status: 500 }
    );
  }
}

/**
 * POST /api/pricing/tiers
 * Create a new pricing tier
 */
export async function POST(request: NextRequest) {
  try {
    const body: PricingTierCreateInput = await request.json();
    
    // Validate required fields
    if (typeof body.minHeadCount !== 'number' || typeof body.minFoodCost !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid required fields: minHeadCount, minFoodCost',
        } as PricingApiResponse,
        { status: 400 }
      );
    }

    // Validate positive values
    if (body.minHeadCount <= 0 || body.minFoodCost < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'minHeadCount must be positive, minFoodCost must be non-negative',
        } as PricingApiResponse,
        { status: 400 }
      );
    }

    // Validate that either fixed prices or percentages are provided
    const hasFixedPrices = body.priceWithTip !== undefined || body.priceWithoutTip !== undefined;
    const hasPercentages = body.percentageWithTip !== undefined || body.percentageWithoutTip !== undefined;
    
    if (!hasFixedPrices && !hasPercentages) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either fixed prices (priceWithTip/priceWithoutTip) or percentages (percentageWithTip/percentageWithoutTip) must be provided',
        } as PricingApiResponse,
        { status: 400 }
      );
    }

    // Validate percentage ranges (0-100)
    if (hasPercentages) {
      if (body.percentageWithTip !== undefined && body.percentageWithTip !== null && (body.percentageWithTip < 0 || body.percentageWithTip > 100)) {
        return NextResponse.json(
          {
            success: false,
            error: 'percentageWithTip must be between 0 and 100',
          } as PricingApiResponse,
          { status: 400 }
        );
      }
      if (body.percentageWithoutTip !== undefined && body.percentageWithoutTip !== null && (body.percentageWithoutTip < 0 || body.percentageWithoutTip > 100)) {
        return NextResponse.json(
          {
            success: false,
            error: 'percentageWithoutTip must be between 0 and 100',
          } as PricingApiResponse,
          { status: 400 }
        );
      }
    }

    const pricingService = new PricingService();
    const newTier = await pricingService.createTier(body);
    
    if (!newTier) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create pricing tier',
        } as PricingApiResponse,
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      {
        success: true,
        data: newTier,
        message: 'Pricing tier created successfully',
      } as PricingApiResponse<PricingTier>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating pricing tier:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to create pricing tier: ${errorMessage}`,
      } as PricingApiResponse,
      { status: 500 }
    );
  }
}

// Method not allowed for other HTTP methods
export async function PUT() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST to create a tier or PUT on /api/pricing/tiers/{id} to update.',
    } as PricingApiResponse,
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use DELETE on /api/pricing/tiers/{id} to delete a specific tier.',
    } as PricingApiResponse,
    { status: 405 }
  );
} 