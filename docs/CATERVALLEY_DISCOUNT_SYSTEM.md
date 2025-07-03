# CaterValley Discount System Documentation

## Overview

The CaterValley Discount System is a comprehensive pricing engine that automatically calculates discounts based on head count and food cost tiers. The system supports both fixed-price and percentage-based pricing models, with different rates for orders with and without tips.

## Features

- **Tiered Pricing Structure**: 5 pricing tiers covering different head count and food cost ranges
- **Dual Pricing Models**: Fixed pricing for smaller orders, percentage-based for large orders (100+ heads)
- **Tip-Based Pricing**: Different rates for orders with and without tips
- **Real-time Calculation**: Debounced pricing calculation for optimal performance
- **Admin Management**: Full CRUD operations for pricing tiers
- **Type Safety**: Complete TypeScript implementation with proper type definitions
- **Database Integration**: Prisma ORM with PostgreSQL backend

## Pricing Tiers

| Tier | Head Count | Food Cost Range | Price w/Tip | Price w/o Tip | Notes |
|------|------------|----------------|-------------|---------------|-------|
| 1    | 1-24       | $0-299.99      | $35.00      | $42.50        | Fixed pricing |
| 2    | 25-49      | $300-599.99    | $45.00      | $52.50        | Fixed pricing |
| 3    | 50-74      | $600-899.99    | $55.00      | $62.50        | Fixed pricing |
| 4    | 75-99      | $900-1199.99   | $65.00      | $72.50        | Fixed pricing |
| 5    | 100+       | $1200+         | 9%          | 10%           | Percentage-based |

## Architecture

### Database Schema

```sql
-- Pricing tiers table
CREATE TABLE "pricing_tiers" (
    "id" TEXT NOT NULL,
    "min_head_count" INTEGER NOT NULL,
    "max_head_count" INTEGER,
    "min_food_cost" DECIMAL(10,2) NOT NULL,
    "max_food_cost" DECIMAL(10,2),
    "price_with_tip" DECIMAL(10,2),
    "price_without_tip" DECIMAL(10,2),
    "percentage_with_tip" DECIMAL(5,2),
    "percentage_without_tip" DECIMAL(5,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- Enhanced catering requests
ALTER TABLE "catering_requests" 
ADD COLUMN "applied_discount" DECIMAL(10,2),
ADD COLUMN "pricing_tier_id" TEXT;
```

### File Structure

```
src/
├── services/pricing/
│   └── pricing.service.ts          # Core business logic
├── hooks/
│   └── usePricing.ts              # React hooks for pricing
├── components/Pricing/
│   └── PricingCalculator.tsx      # UI component
├── app/api/pricing/
│   ├── calculate/route.ts         # Pricing calculation endpoint
│   ├── tiers/route.ts            # Tier management
│   └── tiers/[id]/route.ts       # Individual tier operations
└── types/
    └── pricing.ts                 # TypeScript definitions
```

## API Documentation

### Calculate Pricing

**Endpoint**: `POST /api/pricing/calculate`

**Request Body**:
```json
{
  "headCount": 30,
  "foodCost": 450.00,
  "hasTip": true
}
```

**Response**:
```json
{
  "basePrice": 450.00,
  "discount": 405.00,
  "finalPrice": 45.00,
  "appliedTier": {
    "id": "tier2_...",
    "minHeadCount": 25,
    "maxHeadCount": 49,
    "minFoodCost": 300.00,
    "maxFoodCost": 599.99,
    "priceWithTip": 45.00,
    "priceWithoutTip": 52.50
  },
  "hasTip": true,
  "calculationDetails": {
    "isPercentageBased": false,
    "appliedRate": 45.00,
    "tierName": "Tier 25-49 heads"
  }
}
```

### Manage Pricing Tiers

**Get All Tiers**: `GET /api/pricing/tiers`
**Create Tier**: `POST /api/pricing/tiers`
**Get Tier**: `GET /api/pricing/tiers/[id]`
**Update Tier**: `PUT /api/pricing/tiers/[id]`
**Delete Tier**: `DELETE /api/pricing/tiers/[id]`

## Usage Examples

### React Hook Usage

```typescript
import { usePricingCalculation } from '@/hooks/usePricing';

function OrderForm() {
  const [headCount, setHeadCount] = useState(30);
  const [foodCost, setFoodCost] = useState(450);
  const [hasTip, setHasTip] = useState(true);

  const { data: pricing, isLoading } = usePricingCalculation(
    headCount, 
    foodCost, 
    hasTip
  );

  return (
    <div>
      {pricing && (
        <div>
          <p>Original Price: ${pricing.basePrice}</p>
          <p>Discount: ${pricing.discount}</p>
          <p>Final Price: ${pricing.finalPrice}</p>
        </div>
      )}
    </div>
  );
}
```

### Pricing Calculator Component

```typescript
import { PricingCalculator } from '@/components/Pricing/PricingCalculator';

function CheckoutPage() {
  const handlePricingCalculated = (calculation) => {
    console.log('Pricing calculated:', calculation);
    // Update order total, show discount details, etc.
  };

  return (
    <PricingCalculator
      headCount={orderData.headCount}
      foodCost={orderData.foodCost}
      hasTip={orderData.tip > 0}
      onPricingCalculated={handlePricingCalculated}
      className="mb-6"
    />
  );
}
```

### Service Layer Usage

```typescript
import { pricingService } from '@/services/pricing/pricing.service';

// Calculate pricing
const calculation = await pricingService.calculatePrice(50, 750, true);

// Get all tiers
const tiers = await pricingService.getAllTiers();

// Create new tier
const newTier = await pricingService.createTier({
  minHeadCount: 200,
  maxHeadCount: null,
  minFoodCost: 2000,
  maxFoodCost: null,
  priceWithTip: null,
  priceWithoutTip: null,
  percentageWithTip: 8,
  percentageWithoutTip: 9,
});
```

## Development Commands

### Database Operations

```bash
# Apply migration
npx dotenv -e .env.local -- npx prisma migrate dev --name add-pricing-tiers

# Generate Prisma client
npx dotenv -e .env.local -- npx prisma generate

# Seed pricing tiers
npx dotenv -e .env.local -- tsx scripts/seed-pricing-tiers.ts

# Open Prisma Studio
npm run studio
```

### Testing

```bash
# Run unit tests
npm test src/services/pricing/

# Test pricing calculation API
curl -X POST http://localhost:3000/api/pricing/calculate \
  -H "Content-Type: application/json" \
  -d '{"headCount": 30, "foodCost": 450, "hasTip": true}'
```

## Performance Considerations

### Database Indexes

The system includes optimized indexes for fast pricing tier lookups:

```sql
-- Optimized for head count queries
CREATE INDEX "pricing_tiers_min_head_count_max_head_count_idx" 
ON "pricing_tiers"("min_head_count", "max_head_count");

-- Optimized for food cost queries  
CREATE INDEX "pricing_tiers_min_food_cost_max_food_cost_idx" 
ON "pricing_tiers"("min_food_cost", "max_food_cost");

-- Filter active tiers
CREATE INDEX "pricing_tiers_is_active_idx" 
ON "pricing_tiers"("is_active");
```

### Caching Strategy

- **React Hook Caching**: Uses project's existing `useApiCache` pattern
- **Debounced Calculations**: 300ms debounce for real-time pricing updates
- **API Response Caching**: Consistent caching headers for pricing tier data

### Query Optimization

- **Single Query Lookup**: Finds applicable tier in one database query
- **Proper Ordering**: Orders by `minHeadCount DESC, minFoodCost DESC` for optimal matching
- **Decimal Handling**: Efficient conversion between Prisma Decimal and JavaScript numbers

## Error Handling

### Service Layer
- Comprehensive try-catch blocks with detailed error logging
- Graceful fallbacks for invalid inputs or missing tiers
- Type-safe error responses

### API Layer
- Input validation with detailed error messages
- Proper HTTP status codes (400, 500, etc.)
- Consistent error response format

### Frontend
- Loading states for async operations
- Error boundaries for component failures
- User-friendly error messages

## Security Considerations

### Input Validation
- Server-side validation of all pricing parameters
- SQL injection prevention through Prisma ORM
- Type checking for all inputs

### Access Control
- API endpoints protected by authentication middleware
- Admin-only access for tier management operations
- Rate limiting on pricing calculation endpoints

## Monitoring & Analytics

### Logging
- Detailed logs for all pricing calculations
- Error tracking for failed operations
- Performance metrics for database queries

### Audit Trail
- All tier modifications are logged with timestamps
- Pricing calculation history for order auditing
- User attribution for admin operations

## Migration Notes

### Database Changes
- **Added**: `pricing_tiers` table with full tier configuration
- **Modified**: `catering_requests` table with pricing fields and foreign key
- **Indexed**: Critical fields for performance optimization

### Breaking Changes
- None - this is a new feature addition
- Existing orders are unaffected
- Legacy pricing calculations remain functional

### Rollback Plan
- Pricing tiers can be deactivated without data loss
- Foreign key constraint allows for clean removal
- Migration can be rolled back if needed

## Future Enhancements

### Planned Features
- **Dynamic Tier Management**: Admin UI for tier configuration
- **A/B Testing**: Support for multiple pricing strategies
- **Regional Pricing**: Location-based tier variations
- **Seasonal Adjustments**: Time-based pricing modifications
- **Bulk Pricing**: Volume discounts for multiple orders
- **Custom Pricing**: Client-specific pricing overrides

### Technical Improvements
- **Caching Layer**: Redis caching for frequently accessed tiers
- **Real-time Updates**: WebSocket updates for pricing changes
- **Analytics Dashboard**: Pricing effectiveness metrics
- **Machine Learning**: Predictive pricing recommendations

## Troubleshooting

### Common Issues

**Migration Fails with DIRECT_URL Error**
```bash
# Solution: Use dotenv to load environment variables
npx dotenv -e .env.local -- npx prisma migrate dev
```

**Type Errors with PricingTier Model**
```bash
# Solution: Regenerate Prisma client
npx dotenv -e .env.local -- npx prisma generate
```

**Pricing Calculation Returns No Tier**
- Check head count and food cost ranges
- Verify tier is active (`is_active = true`)
- Ensure tier constraints are properly configured

### Debug Commands

```bash
# Check pricing tiers in database
npx dotenv -e .env.local -- npx prisma studio

# Test specific pricing calculation
node -e "
const { pricingService } = require('./dist/services/pricing/pricing.service.js');
pricingService.calculatePrice(30, 450, true).then(console.log);
"
```

## Support

For issues or questions regarding the CaterValley Discount System:

1. Check this documentation first
2. Review the implementation plan in `docs/to-implement/catervalley-discount-plan.md`
3. Check existing GitHub issues and discussions
4. Contact the development team with specific error messages and reproduction steps

---

**Implementation Date**: July 3, 2025  
**Last Updated**: July 3, 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready 