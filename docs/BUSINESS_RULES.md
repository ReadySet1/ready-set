# Business Rules for Delivery Cost Calculator

This document outlines critical business logic and rules implemented in the delivery cost calculator. These rules should be understood before making configuration changes or modifying calculation logic.

## Table of Contents
- [Driver Pay Calculation](#driver-pay-calculation)
- [MaxPayPerDrop Cap Enforcement](#maxpayperdrop-cap-enforcement)
- [Manual Review Requirements](#manual-review-requirements)
- [Client-Specific Configurations](#client-specific-configurations)
- [Tier System](#tier-system)

## Driver Pay Calculation

### Formula Overview
```
Driver Total Pay = min(Base Pay + Mileage, maxPayPerDrop) + Bonus + Bridge Toll
```

### Calculation Steps
1. **Base Pay**: Determined by headcount tier or flat rate (client-specific)
2. **Mileage Pay**: `max(totalMileage × $0.70, $7.00)` - minimum $7 always applied
3. **Total Base Pay**: `min(Base Pay + Mileage, maxPayPerDrop)` - **CAP APPLIED HERE**
4. **Bonus**: Added AFTER cap (not subject to maxPayPerDrop)
5. **Bridge Toll**: Added AFTER cap (not subject to maxPayPerDrop)

### Key Point: Cap Enforcement
The `maxPayPerDrop` cap is enforced on `Base Pay + Mileage` **ONLY**. Bonus and bridge tolls are added after this cap.

**Example with HY Food Company:**
```typescript
Base Pay: $50 (flat rate)
Mileage (12 miles): $8.40 (12 × $0.70)
Before Cap: $58.40
After Cap: $50 (maxPayPerDrop = 50)
Bonus: $10
Bridge Toll: $8
Final Driver Pay: $50 + $10 + $8 = $68
```

⚠️ **Important**: In the above example, the driver loses $8.40 in mileage pay because the base + mileage exceeds the cap.

## MaxPayPerDrop Cap Enforcement

### Purpose
Protects against excessive driver compensation while allowing bonuses and tolls to be added on top of capped base pay.

### Implementation
Located in `src/lib/calculator/delivery-cost-calculator.ts:468-471`

```typescript
const driverTotalBasePay = Math.min(
  driverBasePay + totalMileagePay,
  config.driverPaySettings.maxPayPerDrop
);
```

### Configuration Examples

| Client | Base Pay | maxPayPerDrop | Mileage Included in Cap? | Bonus Included in Cap? |
|--------|----------|---------------|-------------------------|----------------------|
| Standard | $23 (tiered) | $40 | ✅ Yes | ❌ No |
| Try Hungry | $18-$43 (tiered) | $40 | ✅ Yes | ❌ No |
| HY Food Company | $50 (flat) | $50 | ✅ Yes | ❌ No |

### Business Impact
For clients with flat base pay equal to maxPayPerDrop (like HY Food Company), any mileage will be lost to the cap. This is **intentional** but should be clearly communicated to stakeholders.

## Manual Review Requirements

### Threshold
Orders with **100+ headcount** require manual review for clients with `requiresManualReview: true`.

### Rationale
1. Logistical complexity increases significantly at 100+ people
2. Pricing may need custom negotiation
3. Special arrangements may be required (multiple drivers, staging, etc.)

### Clients Using Manual Review
- **Try Hungry**: 100+ headcount requires manual review
- **Future clients**: Can opt in by setting `requiresManualReview: true`

### Threshold Considerations
The 100 headcount threshold is currently universal. If different clients need different thresholds:
1. Add `manualReviewThreshold?: number` to `ClientDeliveryConfiguration`
2. Update `checkManualReviewRequired()` function
3. Update documentation here

## Client-Specific Configurations

### Standard (Ready Set Food)
- **Base Pay**: Tiered ($18, $23, $33, $43, $53)
- **maxPayPerDrop**: $40
- **Mileage Rate**: $0.70 per mile (standard)
- **Special Notes**: Default configuration for most clients

### Try Hungry
- **Base Pay**: Tiered ($18, $23, $33, $43)
- **maxPayPerDrop**: $40
- **Mileage Rate**: $2.50 per mile (custom - lower than standard)
- **Manual Review**: Required for 100+ headcount
- **Special Notes**: Custom mileage rate reflects lower operational costs

### HY Food Company Direct
- **Base Pay**: Flat $50 (no tiers)
- **maxPayPerDrop**: $50
- **Mileage Rate**: $0.70 per mile (standard)
- **Special Notes**:
  - Unique flat rate model
  - Any mileage will be capped (base already equals max)
  - Bonus and tolls still add on top

### CaterValley
- **Pricing**: Percentage-based for 100+ headcount (10% of food cost)
- **Mileage Rate**: Standard $3.00 per mile
- **Special Notes**: Uses within10Miles rates for deliveries ≤ 10 miles

## Tier System

### How Tiers Work
1. **Tier Lookup**: O(n) search through tier array
2. **Tier Matching**: `headcountMin ≤ headcount ≤ headcountMax`
3. **Last Tier**: Can have `headcountMax: null` for unbounded upper limit

### Tier Validation
The system validates tiers for:
- **Gaps**: Missing headcount ranges between tiers
- **Overlaps**: Conflicting tier ranges
- **Order**: Only last tier can have null max
- **Values**: No negative basePay (except $0 for manual review tiers)

### Example Tier Configuration
```typescript
driverBasePayTiers: [
  { headcountMin: 0, headcountMax: 24, basePay: 18 },   // 0-24 people
  { headcountMin: 25, headcountMax: 49, basePay: 23 },  // 25-49 people
  { headcountMin: 50, headcountMax: 74, basePay: 33 },  // 50-74 people
  { headcountMin: 75, headcountMax: 99, basePay: 43 },  // 75-99 people
  { headcountMin: 100, headcountMax: null, basePay: 0 } // 100+ (manual review)
]
```

## Configuration Change Protocol

When modifying client configurations:

1. **Review Business Impact**: Understand how changes affect driver pay
2. **Update Tests**: Change test expectations to match new requirements
3. **Validate Configuration**: Run `validateConfiguration()` to check for errors
4. **Document Changes**: Update this file with new business rules
5. **Stakeholder Approval**: Get sign-off on pricing changes

## References

### Code Locations
- **Calculation Logic**: `src/lib/calculator/delivery-cost-calculator.ts`
- **Client Configurations**: `src/lib/calculator/client-configurations.ts`
- **Tests**: `src/__tests__/delivery-cost-calculator.test.ts`

### Related Documents
- [Client Configuration Guide](./CLIENT_CONFIGURATION.md) (if exists)
- [Development Logging Cleanup](../reports/console-cleanup/README.md)

## Questions or Issues?

If you encounter unexpected behavior or need clarification:
1. Check test file for documented examples
2. Review client configuration comments
3. Run `validateConfiguration()` on suspect configs
4. Contact the development team with specific scenarios

---
*Last Updated: 2025-11-12*
*Document Maintainer: Development Team*
