# CaterValley Official Pricing Chart

**Document Type:** Authoritative Pricing Reference  
**Source:** CaterValley Terms & Pricing Chart  
**Date:** November 19, 2025  
**Status:** ✅ Active - This is the official pricing specification

---

## Purpose

This document serves as the **authoritative source** for CaterValley pricing calculations. All code implementations, tests, and documentation should reference this file for pricing accuracy.

---

## Core Pricing Rules

### 1. Minimum Delivery Fee
**$42.50** - Always enforced, regardless of calculated price

### 2. Mileage Rate
**$3.00 per mile** - Applied to miles beyond 10-mile threshold

### 3. Distance Threshold
**10 miles** - Mileage charges begin beyond this distance

### 4. Tier Selection Rule
**LESSER FEE** - Use whichever tier (headcount OR food cost) results in the lower delivery fee

---

## Pricing Tiers

### Summary Table

| Tier | Headcount Range | Food Cost Range | Within 10 Miles | Beyond 10 Miles |
|------|-----------------|-----------------|-----------------|-----------------|
| **1** | 0-25 people | $0-$300 | $42.50 | $85 + $3.00/mile |
| **2** | 26-49 people | $300.01-$599.99 | $52.50 | $90 + $3.00/mile |
| **3** | 50-74 people | $600-$899.99 | $62.50 | $110 + $3.00/mile |
| **4** | 75-99 people | $900-$1,199.99 | $72.50 | $120 + $3.00/mile |
| **5** | 100+ people | $1,200+ | 10% of food cost | 10% of food cost + $3.00/mile |

### Detailed Tier Specifications

#### Tier 1: Small Orders
- **Headcount:** ≤25 people
- **Food Cost:** ≤$300
- **Base Fee (≤10 miles):** $42.50
- **Base Fee (>10 miles):** $85.00
- **Mileage:** $3.00 per mile beyond 10 miles

#### Tier 2: Medium Orders
- **Headcount:** 26-49 people
- **Food Cost:** $300.01-$599.99
- **Base Fee (≤10 miles):** $52.50
- **Base Fee (>10 miles):** $90.00
- **Mileage:** $3.00 per mile beyond 10 miles

#### Tier 3: Large Orders
- **Headcount:** 50-74 people
- **Food Cost:** $600-$899.99
- **Base Fee (≤10 miles):** $62.50
- **Base Fee (>10 miles):** $110.00
- **Mileage:** $3.00 per mile beyond 10 miles

#### Tier 4: Extra Large Orders
- **Headcount:** 75-99 people
- **Food Cost:** $900-$1,199.99
- **Base Fee (≤10 miles):** $72.50
- **Base Fee (>10 miles):** $120.00
- **Mileage:** $3.00 per mile beyond 10 miles

#### Tier 5: Percentage-Based Pricing
- **Headcount:** ≥100 people
- **Food Cost:** ≥$1,200
- **Base Fee (≤10 miles):** 10% of food cost
- **Base Fee (>10 miles):** 10% of food cost
- **Mileage:** $3.00 per mile beyond 10 miles

---

## Real-World Pricing Examples

These examples are from actual CaterValley pricing calculations:

### Example 1: Short Distance, Small Order
```
Headcount:        20
Food Cost:        $278.67
Distance:         14.1 miles
-----------------------------------
Tier:             1 (≤25 people, ≤$300)
Base Fee:         $42.50 (minimum enforced)
Miles Over 10:    4.1 miles
Mileage Fee:      4.1 × $3.00 = $12.30
-----------------------------------
TOTAL:            $54.80
```

### Example 2: Just Over Threshold, Medium Order
```
Headcount:        32
Food Cost:        $321.59
Distance:         10.1 miles
-----------------------------------
Tier:             2 (26-49 people, $300-$599)
Base Fee:         $52.50
Miles Over 10:    0.1 miles
Mileage Fee:      0.1 × $3.00 = $0.30
-----------------------------------
TOTAL:            $52.80
```

### Example 3: Under Threshold, Small Order
```
Headcount:        19
Food Cost:        $191.89
Distance:         8.3 miles
-----------------------------------
Tier:             1 (≤25 people, ≤$300)
Base Fee:         $42.50
Miles Over 10:    0 miles (under threshold)
Mileage Fee:      $0.00
-----------------------------------
TOTAL:            $42.50
```

### Example 4: Long Distance, Medium Order
```
Headcount:        30
Food Cost:        $400.00
Distance:         15.0 miles
-----------------------------------
Tier:             2 (26-49 people, $300-$599)
Base Fee:         $90.00 (over 10 miles)
Miles Over 10:    5.0 miles
Mileage Fee:      5.0 × $3.00 = $15.00
-----------------------------------
TOTAL:            $105.00
```

### Example 5: Large Order, Short Distance
```
Headcount:        50
Food Cost:        $750.00
Distance:         8.0 miles
-----------------------------------
Tier:             3 (50-74 people, $600-$899)
Base Fee:         $62.50
Miles Over 10:    0 miles (under threshold)
Mileage Fee:      $0.00
-----------------------------------
TOTAL:            $62.50
```

### Example 6: Very Large Order with Distance
```
Headcount:        100
Food Cost:        $1,500.00
Distance:         15.0 miles
-----------------------------------
Tier:             5 (≥100 people, ≥$1,200)
Base Fee:         $1,500 × 10% = $150.00
Miles Over 10:    5.0 miles
Mileage Fee:      5.0 × $3.00 = $15.00
-----------------------------------
TOTAL:            $165.00
```

---

## Calculation Formula

### Step 1: Determine Tier
```
if (headcount ≤ 25 OR foodCost ≤ 300) → Tier 1
else if (headcount ≤ 49 OR foodCost ≤ 599.99) → Tier 2
else if (headcount ≤ 74 OR foodCost ≤ 899.99) → Tier 3
else if (headcount ≤ 99 OR foodCost ≤ 1199.99) → Tier 4
else → Tier 5
```

Use the tier that results in the **LOWER** delivery fee.

### Step 2: Calculate Base Fee
```
if (distance ≤ 10 miles)
  baseFee = tier.within10Miles
else
  baseFee = tier.regularRate
```

### Step 3: Calculate Mileage Fee
```
if (distance > 10)
  mileageFee = (distance - 10) × 3.00
else
  mileageFee = 0
```

### Step 4: Apply Minimum Fee
```
deliveryFee = baseFee + mileageFee
if (deliveryFee < 42.50)
  deliveryFee = 42.50
```

### Step 5: Calculate Total
```
totalPrice = foodCost + deliveryFee
```

---

## Special Notes

### Bridge Toll Policy
- **Amount:** $8.00 (for San Francisco Bay crossings)
- **Detection:** Automatic via address analysis
- **Customer Charge:** **NOT CHARGED** to CaterValley
- **Payment:** Bridge toll is driver compensation paid by Ready Set

### Distance Calculation
- **Primary Method:** Google Maps Distance Matrix API
- **Fallback Distance:** 10.1 miles (if API fails)
- **Calculation Type:** Driving distance, not straight-line

### Daily Drive Discounts
**NOT APPLICABLE** - CaterValley orders are standalone deliveries without multi-drop discounts.

---

## Implementation References

### Code Location
**File:** `src/lib/calculator/client-configurations.ts`
```typescript
export const CATER_VALLEY: ClientDeliveryConfiguration = {
  id: 'cater-valley',
  clientName: 'CaterValley',
  mileageRate: 3.0,  // $3.00 per mile
  distanceThreshold: 10,
  // ... tier configuration
};
```

### Test Coverage
**File:** `src/__tests__/delivery-cost-calculator.test.ts`
- CaterValley-specific test suite
- Validates all tier calculations
- Verifies mileage rate accuracy
- Confirms minimum fee enforcement

### API Endpoints
- `POST /api/cater-valley/orders/draft` - Price quote
- `POST /api/cater-valley/orders/update` - Recalculate pricing
- `POST /api/cater-valley/orders/confirm` - Finalize order

---

## Pricing Change History

### November 19, 2025
- **Change:** Restored mileage rate to $3.00/mile
- **Previous:** Incorrectly set to $1.10/mile on Nov 13, 2025
- **Reason:** Correction per official Terms & Pricing Chart
- **Impact:** 15-mile orders now correctly charge $15 mileage (not $5.50)

### November 13, 2025
- **Change:** [INCORRECT] Changed mileage rate to $1.10/mile
- **Status:** Reverted on Nov 19, 2025
- **Reason:** Misinterpretation of pricing requirements

### November 10, 2025
- **Change:** Enhanced minimum fee enforcement
- **Details:** Changed from error throw to automatic adjustment
- **Impact:** Orders below $42.50 now auto-adjust without errors

---

## Validation Checklist

Use this checklist to verify pricing calculations:

- [ ] Minimum $42.50 fee enforced?
- [ ] Correct tier selected (lesser of headcount/food cost)?
- [ ] Distance threshold at 10 miles?
- [ ] Mileage rate is $3.00 per mile?
- [ ] Mileage only applied beyond 10 miles?
- [ ] Bridge toll NOT added to customer charge?
- [ ] Tier 5 uses 10% of food cost?

---

## Contact Information

### Ready Set Team
- **Emmanuel Alanis:** ealanis@readysetllc.com (Technical Lead)
- **Gary Vinson:** gary@readysetllc.com
- **Mark Fuentes:** mark@readysetllc.com

### CaterValley Team
- **Halil Han Badem (CTO):** halil@catervalley.com, (408) 217-5114
- **Ugras Bassullu:** ugras@catervalley.com, (650) 519-6151
- **Idris Eyrice:** idris@catervalley.com

---

## Related Documentation

- **API Contract:** `API_CONTRACT.md` - Complete API specification
- **Implementation Status:** `IMPLEMENTATION_STATUS.md` - Integration overview
- **Reference Notes:** `REFERENCE_NOTES.md` - Field mapping and clarifications
- **Bug Fix Summary:** `BUG_FIX_DELIVERY_FEE_SUMMARY.md` - Historical fixes

---

**Last Updated:** November 19, 2025  
**Document Owner:** Emmanuel Alanis  
**Review Frequency:** Quarterly or when pricing changes

