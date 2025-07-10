# CaterValley Discount System Implementation Plan

## Overview
This plan implements a tiered pricing system based on head count and food cost, with different rates for orders with/without tips as shown in the pricing table.

## Database Schema Updates

### 1. Create Discount Configuration Table
```typescript
// prisma/schema.prisma - Add new model
model PricingTier {
  id            String   @id @default(cuid())
  minHeadCount  Int      
  maxHeadCount  Int?     // null for 100+ tier
  minFoodCost   Decimal  @db.Decimal(10, 2)
  maxFoodCost   Decimal? @db.Decimal(10, 2) // null for $1200+ tier
  priceWithTip  Decimal? @db.Decimal(10, 2) // null for percentage-based
  priceWithoutTip Decimal? @db.Decimal(10, 2) // null for percentage-based
  percentageWithTip Decimal? @db.Decimal(5, 2) // 9% for 100+ tier
  percentageWithoutTip Decimal? @db.Decimal(5, 2) // 10% for 100+ tier
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// Add to CateringRequest model
model CateringRequest {
  // ... existing fields ...
  appliedDiscount Decimal? @db.Decimal(10, 2)
  pricingTierId   String?
  pricingTier     PricingTier? @relation(fields: [pricingTierId], references: [id])
}
```

### 2. Seed Pricing Data
```typescript
// prisma/seed/pricing-tiers.ts
const pricingTiers = [
  {
    minHeadCount: 1,
    maxHeadCount: 24,
    minFoodCost: 0,
    maxFoodCost: 299.99,
    priceWithTip: 35.00,
    priceWithoutTip: 42.50,
  },
  {
    minHeadCount: 25,
    maxHeadCount: 49,
    minFoodCost: 300,
    maxFoodCost: 599.99,
    priceWithTip: 45.00,
    priceWithoutTip: 52.50,
  },
  {
    minHeadCount: 50,
    maxHeadCount: 74,
    minFoodCost: 600,
    maxFoodCost: 899.99,
    priceWithTip: 55.00,
    priceWithoutTip: 62.50,
  },
  {
    minHeadCount: 75,
    maxHeadCount: 99,
    minFoodCost: 900,
    maxFoodCost: 1199.99,
    priceWithTip: 65.00,
    priceWithoutTip: 72.50,
  },
  {
    minHeadCount: 100,
    maxHeadCount: null,
    minFoodCost: 1200,
    maxFoodCost: null,
    priceWithTip: null,
    priceWithoutTip: null,
    percentageWithTip: 9,
    percentageWithoutTip: 10,
  },
];
```

## Type Definitions

### 1. Create Pricing Types
```typescript
// src/types/pricing.ts
export interface PricingTier {
  id: string;
  minHeadCount: number;
  maxHeadCount: number | null;
  minFoodCost: number;
  maxFoodCost: number | null;
  priceWithTip: number | null;
  priceWithoutTip: number | null;
  percentageWithTip: number | null;
  percentageWithoutTip: number | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PricingCalculation {
  basePrice: number;
  discount: number;
  finalPrice: number;
  appliedTier: PricingTier | null;
  hasTip: boolean;
}
```

### 2. Update Order Types
```typescript
// src/types/order.ts - Add to CateringRequest interface
export interface CateringRequest extends BaseOrder {
  // ... existing fields ...
  appliedDiscount?: number | null;
  pricingTierId?: string | null;
  pricingTier?: PricingTier | null;
}
```

## Service Layer

### 1. Create Pricing Service
```typescript
// src/services/pricing/pricing.service.ts
import { PrismaClient } from '@prisma/client';
import type { PricingTier, PricingCalculation } from '@/types/pricing';

export class PricingService {
  constructor(private prisma: PrismaClient) {}

  async calculatePrice(
    headCount: number,
    foodCost: number,
    hasTip: boolean
  ): Promise<PricingCalculation> {
    const tier = await this.findApplicableTier(headCount, foodCost);
    
    if (!tier) {
      return {
        basePrice: foodCost,
        discount: 0,
        finalPrice: foodCost,
        appliedTier: null,
        hasTip,
      };
    }

    let finalPrice: number;
    
    if (tier.percentageWithTip && tier.percentageWithoutTip) {
      // Percentage-based pricing (100+ headcount)
      const percentage = hasTip ? tier.percentageWithTip : tier.percentageWithoutTip;
      finalPrice = foodCost * (percentage / 100);
    } else {
      // Fixed pricing
      finalPrice = hasTip ? tier.priceWithTip! : tier.priceWithoutTip!;
    }

    return {
      basePrice: foodCost,
      discount: Math.max(0, foodCost - finalPrice),
      finalPrice,
      appliedTier: tier,
      hasTip,
    };
  }

  async findApplicableTier(
    headCount: number,
    foodCost: number
  ): Promise<PricingTier | null> {
    return await this.prisma.pricingTier.findFirst({
      where: {
        isActive: true,
        minHeadCount: { lte: headCount },
        OR: [
          { maxHeadCount: null },
          { maxHeadCount: { gte: headCount } }
        ],
        minFoodCost: { lte: foodCost },
        AND: [
          {
            OR: [
              { maxFoodCost: null },
              { maxFoodCost: { gte: foodCost } }
            ]
          }
        ]
      }
    });
  }

  async getAllTiers(): Promise<PricingTier[]> {
    return await this.prisma.pricingTier.findMany({
      where: { isActive: true },
      orderBy: [
        { minHeadCount: 'asc' },
        { minFoodCost: 'asc' }
      ]
    });
  }
}
```

### 2. Create Pricing Hooks
```typescript
// src/hooks/usePricing.ts
import { useQuery } from '@tanstack/react-query';
import type { PricingCalculation } from '@/types/pricing';

export function usePricingCalculation(
  headCount: number,
  foodCost: number,
  hasTip: boolean
) {
  return useQuery({
    queryKey: ['pricing', headCount, foodCost, hasTip],
    queryFn: async () => {
      const response = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headCount, foodCost, hasTip }),
      });
      
      if (!response.ok) throw new Error('Failed to calculate pricing');
      return response.json() as Promise<PricingCalculation>;
    },
    enabled: headCount > 0 && foodCost > 0,
  });
}

export function usePricingTiers() {
  return useQuery({
    queryKey: ['pricing-tiers'],
    queryFn: async () => {
      const response = await fetch('/api/pricing/tiers');
      if (!response.ok) throw new Error('Failed to fetch pricing tiers');
      return response.json();
    },
  });
}
```

## API Endpoints

### 1. Pricing Calculation Endpoint
```typescript
// src/app/api/pricing/calculate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PricingService } from '@/services/pricing/pricing.service';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { headCount, foodCost, hasTip } = await request.json();
    
    if (!headCount || !foodCost) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const pricingService = new PricingService(prisma);
    const calculation = await pricingService.calculatePrice(
      headCount,
      foodCost,
      hasTip
    );

    return NextResponse.json(calculation);
  } catch (error) {
    console.error('Pricing calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate pricing' },
      { status: 500 }
    );
  }
}
```

### 2. Pricing Tiers Endpoint
```typescript
// src/app/api/pricing/tiers/route.ts
import { NextResponse } from 'next/server';
import { PricingService } from '@/services/pricing/pricing.service';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const pricingService = new PricingService(prisma);
    const tiers = await pricingService.getAllTiers();
    
    return NextResponse.json(tiers);
  } catch (error) {
    console.error('Fetch pricing tiers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing tiers' },
      { status: 500 }
    );
  }
}
```

### 3. Update CaterValley API Integration
```typescript
// src/app/api/cater-valley/orders/route.ts - Update existing endpoint
import { PricingService } from '@/services/pricing/pricing.service';

export async function POST(request: NextRequest) {
  try {
    const orderData = await request.json();
    
    // Apply pricing calculation
    if (orderData.headcount && orderData.orderTotal) {
      const pricingService = new PricingService(prisma);
      const pricing = await pricingService.calculatePrice(
        orderData.headcount,
        orderData.orderTotal,
        orderData.tip > 0
      );
      
      // Update order with discount information
      orderData.appliedDiscount = pricing.discount;
      orderData.pricingTierId = pricing.appliedTier?.id;
      
      // Adjust final price if discount applies
      if (pricing.discount > 0) {
        orderData.adjustedTotal = pricing.finalPrice;
      }
    }
    
    // ... rest of order creation logic
  } catch (error) {
    // ... error handling
  }
}
```

## UI Components

### 1. Pricing Calculator Component
```typescript
// src/components/pricing/PricingCalculator.tsx
interface PricingCalculatorProps {
  headCount: number;
  foodCost: number;
  hasTip: boolean;
  onPricingCalculated?: (calculation: PricingCalculation) => void;
}

export function PricingCalculator({
  headCount,
  foodCost,
  hasTip,
  onPricingCalculated,
}: PricingCalculatorProps) {
  const { data: calculation, isLoading } = usePricingCalculation(
    headCount,
    foodCost,
    hasTip
  );

  useEffect(() => {
    if (calculation && onPricingCalculated) {
      onPricingCalculated(calculation);
    }
  }, [calculation, onPricingCalculated]);

  if (isLoading) return <div>Calculating pricing...</div>;
  if (!calculation) return null;

  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span>Food Cost:</span>
        <span>${calculation.basePrice.toFixed(2)}</span>
      </div>
      {calculation.discount > 0 && (
        <div className="flex justify-between text-green-600">
          <span>Discount:</span>
          <span>-${calculation.discount.toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold">
        <span>Final Price:</span>
        <span>${calculation.finalPrice.toFixed(2)}</span>
      </div>
    </div>
  );
}
```

### 2. Pricing Tiers Display Component
```typescript
// src/components/pricing/PricingTiersTable.tsx
export function PricingTiersTable() {
  const { data: tiers, isLoading } = usePricingTiers();

  if (isLoading) return <div>Loading pricing tiers...</div>;
  if (!tiers) return null;

  return (
    <table className="min-w-full">
      <thead>
        <tr>
          <th>Head Count</th>
          <th>Food Cost</th>
          <th>Price w/Tip</th>
          <th>Price w/o Tip</th>
        </tr>
      </thead>
      <tbody>
        {tiers.map((tier) => (
          <tr key={tier.id}>
            <td>
              {tier.minHeadCount}
              {tier.maxHeadCount ? `-${tier.maxHeadCount}` : '+'}
            </td>
            <td>
              ${tier.minFoodCost}
              {tier.maxFoodCost ? `-$${tier.maxFoodCost}` : '+'}
            </td>
            <td>
              {tier.priceWithTip 
                ? `$${tier.priceWithTip}` 
                : `${tier.percentageWithTip}% of Food Cost`}
            </td>
            <td>
              {tier.priceWithoutTip 
                ? `$${tier.priceWithoutTip}` 
                : `${tier.percentageWithoutTip}% of Food Cost`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Testing

### 1. Unit Tests for Pricing Service
```typescript
// src/services/pricing/__tests__/pricing.service.test.ts
describe('PricingService', () => {
  it('should calculate fixed price for tier 1 with tip', async () => {
    const result = await pricingService.calculatePrice(20, 250, true);
    expect(result.finalPrice).toBe(35);
    expect(result.discount).toBe(215);
  });

  it('should calculate percentage for 100+ headcount', async () => {
    const result = await pricingService.calculatePrice(150, 1500, true);
    expect(result.finalPrice).toBe(135); // 9% of 1500
  });

  it('should return no discount for invalid tier', async () => {
    const result = await pricingService.calculatePrice(10, 100, true);
    expect(result.discount).toBe(0);
    expect(result.finalPrice).toBe(100);
  });
});
```

### 2. Integration Tests
```typescript
// src/app/api/pricing/__tests__/calculate.test.ts
describe('POST /api/pricing/calculate', () => {
  it('should return pricing calculation', async () => {
    const response = await fetch('/api/pricing/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headCount: 50,
        foodCost: 700,
        hasTip: true,
      }),
    });

    const data = await response.json();
    expect(data.finalPrice).toBe(55);
    expect(data.appliedTier).toBeTruthy();
  });
});
```

## Migration Steps

1. **Database Migration**
   ```bash
   pnpm prisma migrate dev --name add-pricing-tiers
   ```

2. **Seed Pricing Data**
   ```bash
   pnpm prisma db seed
   ```

3. **Deploy API Endpoints**
   - Deploy pricing calculation endpoint
   - Deploy pricing tiers endpoint
   - Update CaterValley integration

4. **Frontend Integration**
   - Add pricing calculator to order forms
   - Display pricing information in order details
   - Add admin interface for managing tiers

5. **Testing & Validation**
   - Run unit tests
   - Run integration tests
   - Manual testing with various scenarios

## Environment Variables
```env
# No new environment variables needed
# Uses existing database connection
```

## Security Considerations

1. **Authorization**: Ensure pricing calculation endpoints are properly secured
2. **Validation**: Validate all input parameters (headCount, foodCost)
3. **Rate Limiting**: Implement rate limiting on pricing calculation endpoint
4. **Audit Trail**: Log all pricing calculations for auditing

## Performance Optimizations

1. **Caching**: Cache pricing tiers in Redis/memory
2. **Database Indexing**: Add indexes on pricing tier lookup fields
3. **Batch Processing**: Support bulk pricing calculations

## Admin Features

1. **Pricing Tier Management**: CRUD operations for pricing tiers
2. **Pricing History**: View historical pricing calculations
3. **Reports**: Generate reports on discount usage
4. **A/B Testing**: Support for testing different pricing structures