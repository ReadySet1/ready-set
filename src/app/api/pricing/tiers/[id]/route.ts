import { NextRequest, NextResponse } from 'next/server';
import { PricingService } from '@/services/pricing/pricing.service';
import type { PricingTier, PricingTierUpdateInput, PricingApiResponse } from '@/types/pricing';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/pricing/tiers/[id]
 * Fetch a single pricing tier by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pricing tier ID is required',
        } as PricingApiResponse,
        { status: 400 }
      );
    }

    const pricingService = new PricingService();
    const tier = await pricingService.getTierById(id);
    
    if (!tier) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pricing tier not found',
        } as PricingApiResponse,
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      {
        success: true,
        data: tier,
        message: 'Pricing tier fetched successfully',
      } as PricingApiResponse<PricingTier>,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching pricing tier:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch pricing tier: ${errorMessage}`,
      } as PricingApiResponse,
      { status: 500 }
    );
  }
}

/**
 * PUT /api/pricing/tiers/[id]
 * Update an existing pricing tier
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pricing tier ID is required',
        } as PricingApiResponse,
        { status: 400 }
      );
    }

    const body: Partial<PricingTierUpdateInput> = await request.json();
    
    // Validate that we're not trying to update system fields
    const updateData = { ...body, id };
    delete (updateData as any).createdAt;
    delete (updateData as any).updatedAt;

    // Validate numbers if provided
    if (updateData.minHeadCount !== undefined && (typeof updateData.minHeadCount !== 'number' || updateData.minHeadCount <= 0)) {
      return NextResponse.json(
        {
          success: false,
          error: 'minHeadCount must be a positive number',
        } as PricingApiResponse,
        { status: 400 }
      );
    }

    if (updateData.minFoodCost !== undefined && (typeof updateData.minFoodCost !== 'number' || updateData.minFoodCost < 0)) {
      return NextResponse.json(
        {
          success: false,
          error: 'minFoodCost must be a non-negative number',
        } as PricingApiResponse,
        { status: 400 }
      );
    }

    // Validate percentages if provided
    if (updateData.percentageWithTip !== undefined && updateData.percentageWithTip !== null) {
      if (typeof updateData.percentageWithTip !== 'number' || updateData.percentageWithTip < 0 || updateData.percentageWithTip > 100) {
        return NextResponse.json(
          {
            success: false,
            error: 'percentageWithTip must be a number between 0 and 100',
          } as PricingApiResponse,
          { status: 400 }
        );
      }
    }

    if (updateData.percentageWithoutTip !== undefined && updateData.percentageWithoutTip !== null) {
      if (typeof updateData.percentageWithoutTip !== 'number' || updateData.percentageWithoutTip < 0 || updateData.percentageWithoutTip > 100) {
        return NextResponse.json(
          {
            success: false,
            error: 'percentageWithoutTip must be a number between 0 and 100',
          } as PricingApiResponse,
          { status: 400 }
        );
      }
    }

    const pricingService = new PricingService();
    const updatedTier = await pricingService.updateTier(updateData as PricingTierUpdateInput);
    
    if (!updatedTier) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update pricing tier or tier not found',
        } as PricingApiResponse,
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      {
        success: true,
        data: updatedTier,
        message: 'Pricing tier updated successfully',
      } as PricingApiResponse<PricingTier>,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating pricing tier:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to update pricing tier: ${errorMessage}`,
      } as PricingApiResponse,
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pricing/tiers/[id]
 * Delete (deactivate) a pricing tier
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pricing tier ID is required',
        } as PricingApiResponse,
        { status: 400 }
      );
    }

    const pricingService = new PricingService();
    const success = await pricingService.deleteTier(id);
    
    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete pricing tier or tier not found',
        } as PricingApiResponse,
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      {
        success: true,
        data: { success: true },
        message: 'Pricing tier deactivated successfully',
      } as PricingApiResponse<{ success: boolean }>,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting pricing tier:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to delete pricing tier: ${errorMessage}`,
      } as PricingApiResponse,
      { status: 500 }
    );
  }
}

// Method not allowed for POST (use the base route for creating)
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST on /api/pricing/tiers to create a new tier.',
    } as PricingApiResponse,
    { status: 405 }
  );
} 