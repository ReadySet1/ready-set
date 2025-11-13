import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db/prisma';
import type { 
  PricingTier, 
  PricingCalculation, 
  PricingTierCreateInput,
  PricingTierUpdateInput 
} from '@/types/pricing';

/**
 * Service class for handling pricing calculations and tier management
 * 
 * ⚠️ IMPORTANT: This service uses database pricing tiers and is NOT used for CaterValley.
 * 
 * CaterValley Integration Uses:
 * - src/lib/calculator/delivery-cost-calculator.ts (calculation engine)
 * - src/lib/calculator/client-configurations.ts (CATER_VALLEY config)
 * - src/app/api/cater-valley/_lib/pricing-helper.ts (API integration)
 * 
 * This service is for:
 * - Admin pricing tier management (database CRUD)
 * - Generic pricing calculations (non-client-specific)
 * - NOT for CaterValley API endpoints
 */
export class PricingService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || prisma;
  }

  /**
   * Calculate the final price based on head count, food cost, and tip status
   */
  async calculatePrice(
    headCount: number,
    foodCost: number,
    hasTip: boolean
  ): Promise<PricingCalculation> {
    try {
      // Validate inputs
      if (headCount <= 0 || foodCost <= 0) {
        return {
          basePrice: foodCost,
          discount: 0,
          finalPrice: foodCost,
          appliedTier: null,
          hasTip,
          calculationDetails: {
            isPercentageBased: false,
            tierName: 'No tier applied - invalid inputs',
          },
        };
      }

      const tier = await this.findApplicableTier(headCount, foodCost);
      
      if (!tier) {
        return {
          basePrice: foodCost,
          discount: 0,
          finalPrice: foodCost,
          appliedTier: null,
          hasTip,
          calculationDetails: {
            isPercentageBased: false,
            tierName: 'No applicable tier found',
          },
        };
      }

      let finalPrice: number;
      let isPercentageBased = false;
      let appliedRate: number | undefined;

      // Convert Decimal values to numbers for calculations
      const percentageWithTip = tier.percentageWithTip ? 
        (typeof tier.percentageWithTip === 'number' ? tier.percentageWithTip : tier.percentageWithTip.toNumber()) : null;
      const percentageWithoutTip = tier.percentageWithoutTip ? 
        (typeof tier.percentageWithoutTip === 'number' ? tier.percentageWithoutTip : tier.percentageWithoutTip.toNumber()) : null;
      const priceWithTip = tier.priceWithTip ? 
        (typeof tier.priceWithTip === 'number' ? tier.priceWithTip : tier.priceWithTip.toNumber()) : null;
      const priceWithoutTip = tier.priceWithoutTip ? 
        (typeof tier.priceWithoutTip === 'number' ? tier.priceWithoutTip : tier.priceWithoutTip.toNumber()) : null;
      
      if (percentageWithTip && percentageWithoutTip) {
        // Percentage-based pricing (100+ headcount)
        const percentage = hasTip ? percentageWithTip : percentageWithoutTip;
        finalPrice = foodCost * (percentage / 100);
        isPercentageBased = true;
        appliedRate = percentage;
      } else {
        // Fixed pricing
        finalPrice = hasTip ? (priceWithTip || foodCost) : (priceWithoutTip || foodCost);
        appliedRate = finalPrice;
      }

      const discount = Math.max(0, foodCost - finalPrice);

      return {
        basePrice: foodCost,
        discount,
        finalPrice,
        appliedTier: this.convertPrismaToInterface(tier),
        hasTip,
        calculationDetails: {
          isPercentageBased,
          appliedRate,
          tierName: `Tier ${tier.minHeadCount}${tier.maxHeadCount ? `-${tier.maxHeadCount}` : '+'} heads`,
        },
      };
    } catch (error) {
      console.error('Error calculating price:', error);
      return {
        basePrice: foodCost,
        discount: 0,
        finalPrice: foodCost,
        appliedTier: null,
        hasTip,
        calculationDetails: {
          isPercentageBased: false,
          tierName: 'Error in calculation',
        },
      };
    }
  }

  /**
   * Find the applicable pricing tier based on head count and food cost
   */
  async findApplicableTier(
    headCount: number,
    foodCost: number
  ): Promise<any | null> {
    try {
      return await this.prisma.pricingTier.findFirst({
        where: {
          isActive: true,
          minHeadCount: { lte: headCount },
          OR: [
            { maxHeadCount: null },
            { maxHeadCount: { gte: headCount } }
          ],
          minFoodCost: { lte: new Decimal(foodCost) },
          AND: [
            {
              OR: [
                { maxFoodCost: null },
                { maxFoodCost: { gte: new Decimal(foodCost) } }
              ]
            }
          ]
        },
        orderBy: [
          { minHeadCount: 'desc' },
          { minFoodCost: 'desc' }
        ]
      });
    } catch (error) {
      console.error('Error finding applicable tier:', error);
      return null;
    }
  }

  /**
   * Get all active pricing tiers
   */
  async getAllTiers(): Promise<PricingTier[]> {
    try {
      const tiers = await this.prisma.pricingTier.findMany({
        where: { isActive: true },
        orderBy: [
          { minHeadCount: 'asc' },
          { minFoodCost: 'asc' }
        ]
      });

      return tiers.map(this.convertPrismaToInterface);
    } catch (error) {
      console.error('Error fetching pricing tiers:', error);
      return [];
    }
  }

  /**
   * Create a new pricing tier
   */
  async createTier(data: PricingTierCreateInput): Promise<PricingTier | null> {
    try {
      const tier = await this.prisma.pricingTier.create({
        data: {
          ...data,
          minFoodCost: new Decimal(data.minFoodCost),
          maxFoodCost: data.maxFoodCost ? new Decimal(data.maxFoodCost) : null,
          priceWithTip: data.priceWithTip ? new Decimal(data.priceWithTip) : null,
          priceWithoutTip: data.priceWithoutTip ? new Decimal(data.priceWithoutTip) : null,
          percentageWithTip: data.percentageWithTip ? new Decimal(data.percentageWithTip) : null,
          percentageWithoutTip: data.percentageWithoutTip ? new Decimal(data.percentageWithoutTip) : null,
        }
      });

      return this.convertPrismaToInterface(tier);
    } catch (error) {
      console.error('Error creating pricing tier:', error);
      return null;
    }
  }

  /**
   * Update an existing pricing tier
   */
  async updateTier(data: PricingTierUpdateInput): Promise<PricingTier | null> {
    try {
      const updateData: any = { ...data };
      delete updateData.id;

      // Convert numbers to Decimal where needed
      if (updateData.minFoodCost !== undefined) {
        updateData.minFoodCost = new Decimal(updateData.minFoodCost);
      }
      if (updateData.maxFoodCost !== undefined) {
        updateData.maxFoodCost = updateData.maxFoodCost ? new Decimal(updateData.maxFoodCost) : null;
      }
      if (updateData.priceWithTip !== undefined) {
        updateData.priceWithTip = updateData.priceWithTip ? new Decimal(updateData.priceWithTip) : null;
      }
      if (updateData.priceWithoutTip !== undefined) {
        updateData.priceWithoutTip = updateData.priceWithoutTip ? new Decimal(updateData.priceWithoutTip) : null;
      }
      if (updateData.percentageWithTip !== undefined) {
        updateData.percentageWithTip = updateData.percentageWithTip ? new Decimal(updateData.percentageWithTip) : null;
      }
      if (updateData.percentageWithoutTip !== undefined) {
        updateData.percentageWithoutTip = updateData.percentageWithoutTip ? new Decimal(updateData.percentageWithoutTip) : null;
      }

      const tier = await this.prisma.pricingTier.update({
        where: { id: data.id },
        data: updateData
      });

      return this.convertPrismaToInterface(tier);
    } catch (error) {
      console.error('Error updating pricing tier:', error);
      return null;
    }
  }

  /**
   * Delete (deactivate) a pricing tier
   */
  async deleteTier(id: string): Promise<boolean> {
    try {
      await this.prisma.pricingTier.update({
        where: { id },
        data: { isActive: false }
      });
      return true;
    } catch (error) {
      console.error('Error deleting pricing tier:', error);
      return false;
    }
  }

  /**
   * Get a single pricing tier by ID
   */
  async getTierById(id: string): Promise<PricingTier | null> {
    try {
      const tier = await this.prisma.pricingTier.findUnique({
        where: { id }
      });

      return tier ? this.convertPrismaToInterface(tier) : null;
    } catch (error) {
      console.error('Error fetching pricing tier:', error);
      return null;
    }
  }

  /**
   * Convert Prisma model to interface (handles Decimal conversion)
   */
  private convertPrismaToInterface(tier: any): PricingTier {
    return {
      id: tier.id,
      minHeadCount: tier.minHeadCount,
      maxHeadCount: tier.maxHeadCount,
      minFoodCost: tier.minFoodCost instanceof Decimal ? tier.minFoodCost.toNumber() : tier.minFoodCost,
      maxFoodCost: tier.maxFoodCost ? 
        (tier.maxFoodCost instanceof Decimal ? tier.maxFoodCost.toNumber() : tier.maxFoodCost) : null,
      priceWithTip: tier.priceWithTip ? 
        (tier.priceWithTip instanceof Decimal ? tier.priceWithTip.toNumber() : tier.priceWithTip) : null,
      priceWithoutTip: tier.priceWithoutTip ? 
        (tier.priceWithoutTip instanceof Decimal ? tier.priceWithoutTip.toNumber() : tier.priceWithoutTip) : null,
      percentageWithTip: tier.percentageWithTip ? 
        (tier.percentageWithTip instanceof Decimal ? tier.percentageWithTip.toNumber() : tier.percentageWithTip) : null,
      percentageWithoutTip: tier.percentageWithoutTip ? 
        (tier.percentageWithoutTip instanceof Decimal ? tier.percentageWithoutTip.toNumber() : tier.percentageWithoutTip) : null,
      isActive: tier.isActive,
      createdAt: tier.createdAt,
      updatedAt: tier.updatedAt,
    };
  }
}

// Export singleton instance
export const pricingService = new PricingService(); 