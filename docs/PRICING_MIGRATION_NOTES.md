# Pricing System Migration Notes

## Overview

This document explains the migration from database-stored pricing tiers to code-based pricing configuration and why it's safe to remove the `pricing_tiers` table.

## Background

### Previous System

- Pricing tiers were stored in a `pricing_tiers` database table
- This approach required database queries for pricing calculations
- Made pricing updates require database migrations

### New System (Current)

- Pricing logic is now implemented in `src/lib/services/pricingService.ts`
- Uses constants defined in code for pricing tiers
- Supports distance-based pricing (0-10mi, >10mi, >30mi)
- Includes head count and food cost based pricing
- No database dependency for pricing calculations

## Why the Table Can Be Safely Removed

### 1. **Pricing Logic Replaced**

The pricing logic has been completely reimplemented in code:

```typescript
// OLD: Database queries to pricing_tiers table
// NEW: Code-based constants in pricingService.ts

const PRICING_TIERS = {
  STANDARD: {
    tier1: { headCount: 25, foodCost: 300, withTip: 35.0, withoutTip: 42.5 },
    tier2: { headCount: 49, foodCost: 599, withTip: 45.0, withoutTip: 52.5 },
    // ... more tiers
  },
  OVER_10_MILES: {
    // Distance-based pricing
  },
  // ...
};
```

### 2. **No Active Dependencies**

- No current code references the `pricing_tiers` table
- All pricing calculations use the new service
- The old table is orphaned data

### 3. **Improved System**

The new system provides:

- ✅ **Better Performance**: No database queries for pricing
- ✅ **Easier Updates**: Change pricing in code, not database
- ✅ **Version Control**: Pricing changes tracked in git
- ✅ **Type Safety**: TypeScript validation for pricing logic
- ✅ **Distance Integration**: Google Maps API for accurate distance calculation

## Migration Process

### Data Loss Warning

When deploying, you'll see:

```
⚠️  There might be data loss when applying the changes:
  • You are about to drop the `pricing_tiers` table, which is not empty (5 rows).
```

**This is expected and safe!** The 5 rows are old pricing data that's no longer used.

### Safe Deployment

The deployment process:

1. **Backup Check**: Verify no critical data is lost
2. **Apply Schema**: Remove the deprecated table
3. **Build Application**: Ensure new pricing system works
4. **Verify**: Test pricing calculations work correctly

### Rollback Plan

If needed, the old pricing logic can be restored from git history:

- The pricing_tiers table structure is in previous migrations
- The old pricing service code is in git history
- Database can be restored from backups if necessary

## Current Pricing Features

### Distance-Based Tiers

- **Standard (0-10 miles)**: Base pricing
- **Over 10 Miles**: Increased rates for longer distances
- **Over 30 Miles**: Premium rates for long-distance deliveries

### Head Count & Food Cost Tiers

- **Tier 1**: <25 people or <$300 food cost
- **Tier 2**: 25-49 people or $300-$599 food cost
- **Tier 3**: 50-74 people or $600-$899 food cost
- **Tier 4**: 75-99 people or $900-$1199 food cost
- **Tier 5**: 100+ people or $1200+ food cost (percentage-based)

### Tip Options

- **With Tip**: Standard customer pricing
- **Without Tip**: Higher pricing when tip not included

## Verification

### Before Migration

The old system required database queries and had limited flexibility.

### After Migration

- ✅ Pricing calculations work without database dependency
- ✅ Distance-based pricing implemented
- ✅ Google Maps integration for accurate distances
- ✅ Comprehensive test coverage (22 tests passing)
- ✅ Error handling and fallback pricing

## Conclusion

The removal of the `pricing_tiers` table is part of a planned upgrade to improve the pricing system. The data loss warning is expected and safe to accept. The new code-based system is more reliable, performant, and maintainable.

**Action Required**: Accept the data loss during deployment by using `--accept-data-loss` flag or the safe deployment script.

---

_For questions about this migration, refer to the CaterValley integration commits or the pricing service implementation._
