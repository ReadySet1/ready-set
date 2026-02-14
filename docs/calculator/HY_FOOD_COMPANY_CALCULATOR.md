# HY Food Company - Calculator Drive Pricing Documentation

> **Last Updated:** February 7, 2026
> **Configuration ID:** `hy-food-company-direct`
> **Source Files:**
> - `src/lib/calculator/client-configurations.ts` (HY_FOOD_COMPANY_DIRECT)
> - `src/lib/calculator/delivery-cost-calculator.ts`
> - `src/lib/calculator/__tests__/hy-food-company-pricing.test.ts`

---

## Table of Contents

1. [Overview](#overview)
2. [Two Pricing Modes](#two-pricing-modes)
3. [Zero-Order Mode (Standard Drive)](#zero-order-mode-standard-drive)
4. [Normal Mode (Order with Details)](#normal-mode-order-with-details)
5. [Customer Delivery Fee](#customer-delivery-fee)
6. [Ready Set Fee](#ready-set-fee)
7. [Driver Payment](#driver-payment)
8. [Mileage Calculations](#mileage-calculations)
9. [Daily Drive Discounts](#daily-drive-discounts)
10. [Multi-Stop Deliveries](#multi-stop-deliveries)
11. [Bridge Toll](#bridge-toll)
12. [Profit Calculation](#profit-calculation)
13. [LESSER Rule Explained](#lesser-rule-explained)
14. [Worked Examples](#worked-examples)
15. [Comparison with Other Clients](#comparison-with-other-clients)
16. [Recent Changes](#recent-changes)

---

## Overview

HY Food Company is a direct client with a unique two-mode pricing structure in the Ready Set admin calculator. The calculator determines three core values for every delivery:

| Component | Description |
|---|---|
| **Customer Delivery Fee** | What HY Food Company is charged for the delivery |
| **Ready Set Fee** | What Ready Set earns from the delivery |
| **Driver Payment** | What the driver is paid for the delivery |

The profit formula is:

```
Profit = Customer Delivery Fee - Driver Payment - Ready Set Fee
```

---

## Two Pricing Modes

HY Food Company operates in **two distinct pricing modes** depending on whether order details (headcount and food cost) are provided:

| Mode | Trigger Condition | Use Case |
|---|---|---|
| **Zero-Order Mode** | `headcount = 0` AND `foodCost = 0` AND `mileage <= 10` | Standard drives without order details |
| **Normal Mode** | `headcount > 0` OR `foodCost > 0` | Orders with headcount and/or food cost information |

---

## Zero-Order Mode (Standard Drive)

**Applies when:** Headcount = 0 AND Food Cost = $0 AND Mileage <= 10 miles

This mode is used for standard HY Food Company drives where no specific order details are provided (e.g., a routine pickup/delivery within the local area).

### Zero-Order Fee Breakdown

| Component | Amount | Notes |
|---|---|---|
| **Customer pays** | **$50.00** | Flat fee |
| **Ready Set Fee** | **$50.00** | Equals the customer fee |
| **Driver Base Pay** | $13.00 | Flat |
| **Driver Mileage** | $7.00 | Flat (not per-mile) |
| **Driver Bonus** | $10.00 | If bonus-qualified |
| **Total Driver Pay** | **$30.00** | $13 + $7 + $10 |

### Zero-Order Constraints

- Only applies for deliveries **within 10 miles**
- If mileage exceeds 10 miles with zero headcount/food cost, the system falls back to **Normal Mode** using the lowest tier
- No daily drive discount is applied in zero-order mode
- No driver pay cap (maxPayPerDrop = null)

---

## Normal Mode (Order with Details)

**Applies when:** Headcount > 0 OR Food Cost > $0

In normal mode, all fees are calculated using a **tiered pricing system** based on headcount and food cost. The system uses the **LESSER rule** -- it compares the fee from the headcount tier against the fee from the food cost tier and uses whichever is lower.

---

## Customer Delivery Fee

### Pricing Tiers (Flat Fee Model)

HY Food Company uses **flat fee pricing** -- the base delivery fee is the same regardless of whether the delivery is within or beyond 10 miles. Mileage charges are added separately for deliveries over 10 miles.

| Tier | Headcount | Food Cost | Delivery Fee |
|---|---|---|---|
| 1 | 0 - 24 | $0 - $299.99 | **$60** |
| 2 | 25 - 49 | $300 - $599.99 | **$70** |
| 3 | 50 - 74 | $600 - $899.99 | **$90** |
| 4 | 75 - 99 | $900 - $1,199.99 | **$100** |
| 5 | 100 - 124 | $1,200 - $1,499.99 | **$120** |
| 6 | 125 - 149 | $1,500 - $1,699.99 | **$150** |
| 7 | 150 - 174 | $1,700 - $1,899.99 | **$180** |
| 8 | 175 - 199 | $1,900 - $2,099.99 | **$210** |
| 9 | 200 - 249 | $2,100 - $2,299.99 | **$280** |
| 10 | 250 - 299 | $2,300 - $2,499.99 | **$310** |
| 11 | 300+ | $2,500+ | **TBD** (contact support) |

### Customer Fee Formula

```
Customer Delivery Fee = Base Delivery Fee (from tier)
                      + Mileage Charges ($2.50/mi for miles over 10)
                      - Daily Drive Discount
                      + Extra Stops Charge ($5.00 per additional stop)
                      + Bridge Toll (if applicable)
```

---

## Ready Set Fee

The Ready Set fee for HY Food Company is **dynamic** -- it matches the customer's tier-based delivery fee (not a fixed amount).

| Mode | Ready Set Fee |
|---|---|
| **Zero-Order** | $50.00 (fixed) |
| **Normal Mode** | Equals the customer's base delivery fee from the tier table |

### Examples

| Headcount | Food Cost | Customer Tier Fee | Ready Set Fee |
|---|---|---|---|
| 0 (zero-order) | $0 | $50 | **$50** |
| 20 | $200 | $60 | **$60** |
| 30 | $400 | $70 | **$70** |
| 60 | $700 | $90 | **$90** |
| 100 | $1,300 | $120 | **$120** |

> **Key difference from other clients:** Most other clients (e.g., CaterValley, Try Hungry) have a fixed Ready Set fee (typically $70). HY Food Company's Ready Set fee scales with the delivery tier because `readySetFeeMatchesDeliveryFee` is set to `true` in the configuration.

---

## Driver Payment

### Driver Base Pay Tiers (By Headcount)

| Headcount Range | Driver Base Pay |
|---|---|
| 0 - 24 | **$13.00** |
| 25 - 49 | **$23.00** |
| 50 - 74 | **$33.00** |
| 75 - 99 | **$43.00** |
| 100+ | **$53.00** |

### Driver Base Pay Tiers (By Food Cost -- When Headcount = 0)

When headcount is 0 but food cost is greater than $0, the system uses **food cost tiers** to determine driver base pay:

| Food Cost Range | Driver Base Pay |
|---|---|
| $0 - $299.99 | **$13.00** |
| $300 - $599.99 | **$23.00** |
| $600 - $899.99 | **$33.00** |
| $900 - $1,199.99 | **$43.00** |
| $1,200+ | **$53.00** |

> **Note:** When headcount > 0, headcount-based tiers always take precedence, regardless of food cost.

### Driver Bonus

- **Amount:** $10.00
- **Condition:** Driver must be bonus-qualified
- **Partial bonus:** Supports percentage-based qualification (e.g., 80% = $8.00) for drivers with infractions
- **Excluded when:** Direct tip is provided (tips and base pay + bonus are mutually exclusive)

### Driver Pay Cap

- **HY Food Company has NO driver pay cap** (`maxPayPerDrop: null`)
- This differs from other clients like Ready Set Food Standard ($40 cap) and Try Hungry ($40 cap)

### Driver Pay Formula (Normal Mode)

```
Total Driver Pay = Driver Base Pay (from tier)
                 + Mileage Pay (see Mileage section)
                 + Bonus ($10 if qualified)
                 + Extra Stops Bonus ($2.50 per additional stop)
                 + Direct Tip (if any, excludes base pay and bonus)
```

---

## Mileage Calculations

HY Food Company has **two separate mileage calculation systems** -- one for the customer fee and one for driver pay.

### Customer Mileage

| Condition | Mileage Charge |
|---|---|
| Within 10 miles | **$0** (no additional charge) |
| Over 10 miles | **$2.50 per mile** for miles beyond 10 |

**Examples:**

| Total Miles | Extra Miles | Customer Mileage Charge |
|---|---|---|
| 8 | 0 | $0.00 |
| 10 | 0 | $0.00 |
| 11 | 1 | $2.50 |
| 15 | 5 | $12.50 |
| 20 | 10 | $25.00 |

> **HY Food Company specific:** The customer mileage rate is **$2.50/mile**, which is lower than the standard Ready Set rate of $3.00/mile.

### Driver Mileage

HY Food Company uses a **unique two-tier mileage system** for driver pay:

| Condition | Driver Mileage Pay |
|---|---|
| Within 10 miles | **$7.00 flat** (regardless of actual distance) |
| Over 10 miles | **Total miles x $0.70** (all miles, not just extra) |

**Examples:**

| Total Miles | Driver Mileage Pay | Calculation |
|---|---|---|
| 3 | $7.00 | Flat rate (within threshold) |
| 5 | $7.00 | Flat rate (within threshold) |
| 10 | $7.00 | Flat rate (at threshold) |
| 11 | $7.70 | 11 x $0.70 |
| 15 | $10.50 | 15 x $0.70 |
| 20 | $14.00 | 20 x $0.70 |

> **Important distinction:** When over 10 miles, the rate is applied to ALL miles (total mileage), not just the miles beyond 10. This is different from the customer mileage calculation which only charges for miles beyond 10.

---

## Daily Drive Discounts

When a driver makes multiple deliveries in a day, a per-drive discount is applied to the **customer delivery fee**:

| Daily Drives | Discount per Drive | Total Discount (example: 3 drives) |
|---|---|---|
| 1 | $0 | $0 |
| 2 | $5 | $10 ($5 x 2) |
| 3 | $10 | $30 ($10 x 3) |
| 4+ | $15 | $60 ($15 x 4) |

> **Note:** The discount is applied **per drive** and multiplied by the number of drives. For example, 3 daily drives at $10/drive = $30 total discount.

### Daily Drive Discount Example

- Headcount: 25, Food Cost: $400 (Tier = $70)
- 3 daily drives: Discount = $10 x 3 = $30
- Customer Delivery Fee = $70 - $30 = **$40**

---

## Multi-Stop Deliveries

When a delivery has multiple stops, additional charges/bonuses apply:

| Component | Rate | Applied To |
|---|---|---|
| **Customer Extra Stop Charge** | $5.00 per additional stop | Customer delivery fee |
| **Driver Extra Stop Bonus** | $2.50 per additional stop | Driver payment |

The first stop is included in the base delivery cost. Additional stops are charged separately.

**Example:** A delivery with 3 stops:
- Customer extra charge: (3 - 1) x $5.00 = $10.00
- Driver extra bonus: (3 - 1) x $2.50 = $5.00

---

## Bridge Toll

| Setting | Value |
|---|---|
| **Default toll amount** | $8.00 |
| **Auto-apply areas** | San Francisco, Oakland, Marin County |

- Bridge toll is included in the **customer delivery fee**
- Bridge toll is **compensated to the driver** (added to driver payment)
- Bridge toll is included in the **Ready Set total fee** calculation

---

## Profit Calculation

```
Profit = Customer Delivery Fee - Total Driver Pay - Ready Set Total Fee
```

Where:
- **Customer Delivery Fee** = Base tier fee + mileage charges - daily drive discount + extra stops + bridge toll
- **Total Driver Pay** = Base pay + mileage pay + bonus + extra stops bonus + direct tip
- **Ready Set Total Fee** = Ready Set fee + addon fees + bridge toll

---

## LESSER Rule Explained

When both headcount and food cost are provided, the calculator determines two potential tiers:
1. The tier based on **headcount**
2. The tier based on **food cost**

It then compares the **resulting fee amounts** and uses whichever produces the **lower** (lesser) fee. This is the "conservative" approach that favors the client.

### LESSER Rule Examples

| Headcount | HC Tier | HC Fee | Food Cost | FC Tier | FC Fee | **Used Fee** |
|---|---|---|---|---|---|---|
| 25 | 25-49 | $70 | $200 | 0-24 | $60 | **$60** (FC lower) |
| 50 | 50-74 | $90 | $400 | 25-49 | $70 | **$70** (FC lower) |
| 25 | 25-49 | $70 | $700 | 50-74 | $90 | **$70** (HC lower) |
| 50 | 50-74 | $90 | $700 | 50-74 | $90 | **$90** (same) |

### Special Cases

- **Headcount = 0, Food Cost > 0:** Only food cost tier is used
- **Food Cost = 0, Headcount > 0:** Only headcount tier is used
- **Both = 0:** Zero-order mode kicks in (if within 10 miles)

---

## Worked Examples

### Example 1: Zero-Order Drive (Standard Drive, 10 miles)

**Input:** Headcount = 0, Food Cost = $0, Mileage = 10 mi, Bonus Qualified = Yes

| Component | Amount | Notes |
|---|---|---|
| Customer Fee | $50.00 | Zero-order flat fee |
| Ready Set Fee | $50.00 | Matches customer fee |
| Driver Base Pay | $13.00 | Zero-order flat |
| Driver Mileage | $7.00 | Zero-order flat |
| Driver Bonus | $10.00 | Bonus qualified |
| **Total Driver Pay** | **$30.00** | $13 + $7 + $10 |

---

### Example 2: Small Order, Within 10 Miles

**Input:** Headcount = 30, Food Cost = $400, Mileage = 5 mi, Bonus Qualified = Yes

| Component | Amount | Notes |
|---|---|---|
| Customer Tier Fee | $70.00 | Tier 25-49 (flat fee) |
| Customer Mileage | $0.00 | Within 10 miles |
| **Customer Delivery Fee** | **$70.00** | |
| Ready Set Fee | $70.00 | Matches tier fee |
| Driver Base Pay | $23.00 | Headcount tier 25-49 |
| Driver Mileage | $7.00 | Flat $7 (within 10 mi) |
| Driver Bonus | $10.00 | Bonus qualified |
| **Total Driver Pay** | **$40.00** | $23 + $7 + $10 |

---

### Example 3: Medium Order, Beyond 10 Miles

**Input:** Headcount = 30, Food Cost = $400, Mileage = 15 mi, Bonus Qualified = Yes

| Component | Amount | Notes |
|---|---|---|
| Customer Tier Fee | $70.00 | Tier 25-49 (flat fee) |
| Customer Mileage | $12.50 | (15 - 10) x $2.50 |
| **Customer Delivery Fee** | **$82.50** | $70 + $12.50 |
| Ready Set Fee | $70.00 | Matches tier fee (not mileage) |
| Driver Base Pay | $23.00 | Headcount tier 25-49 |
| Driver Mileage | $10.50 | 15 x $0.70 (all miles) |
| Driver Bonus | $10.00 | Bonus qualified |
| **Total Driver Pay** | **$43.50** | $23 + $10.50 + $10 |

---

### Example 4: Food Cost Only (No Headcount), Within 10 Miles

**Input:** Headcount = 0, Food Cost = $700, Mileage = 8 mi, Bonus Qualified = Yes

| Component | Amount | Notes |
|---|---|---|
| Customer Tier Fee | $90.00 | Food cost tier $600-$899 |
| Customer Mileage | $0.00 | Within 10 miles |
| **Customer Delivery Fee** | **$90.00** | |
| Ready Set Fee | $90.00 | Matches tier fee |
| Driver Base Pay | $33.00 | Food cost tier $600-$899 |
| Driver Mileage | $7.00 | Flat $7 (within 10 mi) |
| Driver Bonus | $10.00 | Bonus qualified |
| **Total Driver Pay** | **$50.00** | $33 + $7 + $10 |

---

### Example 5: With Daily Drive Discount and Bridge Toll

**Input:** Headcount = 25, Food Cost = $400, Mileage = 8 mi, Daily Drives = 3, Bridge = Yes, Bonus Qualified = Yes

| Component | Amount | Notes |
|---|---|---|
| Customer Tier Fee | $70.00 | Tier 25-49 |
| Customer Mileage | $0.00 | Within 10 miles |
| Daily Drive Discount | -$30.00 | $10 x 3 drives |
| Bridge Toll | $8.00 | SF/Oakland area |
| **Customer Delivery Fee** | **$48.00** | $70 - $30 + $8 |
| Ready Set Fee | $70.00 | Matches tier fee |
| Ready Set Total Fee | $78.00 | $70 + $8 (bridge) |
| Driver Base Pay | $23.00 | Headcount tier 25-49 |
| Driver Mileage | $7.00 | Flat $7 (within 10 mi) |
| Driver Bonus | $10.00 | Bonus qualified |
| Bridge Toll Compensation | $8.00 | Reimbursed to driver |
| **Total Driver Pay** | **$40.00** | $23 + $7 + $10 (bridge toll separate) |

---

## Comparison with Other Clients

| Feature | HY Food Company | Ready Set Standard | CaterValley | Try Hungry |
|---|---|---|---|---|
| **Customer Mileage Rate** | $2.50/mi | $3.00/mi | $3.00/mi | $2.50/mi |
| **Driver Mileage** | Flat $7 / Total x $0.70 | All miles x $0.35 | All miles x $0.70 | All miles x $0.35 |
| **Driver Base Pay** | Tiered $13-$53 | Tiered $18-$53 | $18 flat | Tiered $18-$43 |
| **Driver Pay Cap** | None | $40 | None | $40 |
| **Ready Set Fee** | Dynamic (matches tier) | $70 fixed | $70 fixed | $70 fixed |
| **Zero-Order Mode** | Yes ($50/$30) | No | No | No |
| **Flat Fee Pricing** | Yes (same rate all distances) | Yes | No (within/beyond) | Yes |
| **Manual Review (100+ HC)** | No | No | No | Yes |

---

## Recent Changes

### Phase 1: HY Food Company Calculator Implementation (January 2026)

**Commit:** `a9772c9b` - Working on calculator for HY Food Company client phase 1

Key changes introduced:

1. **HY_FOOD_COMPANY_DIRECT configuration created** (`client-configurations.ts`)
   - Added complete client configuration with all pricing tiers
   - Set custom mileage rate at $2.50/mile (lower than standard $3.00)
   - Configured tiered driver base pay ($13-$53 by headcount)
   - Added food cost-based driver pay tiers (for when headcount = 0)

2. **Zero-Order Mode implemented** (`delivery-cost-calculator.ts`)
   - Added `zeroOrderSettings` to the configuration interface
   - Customer/Ready Set fee: $50 flat
   - Driver pay: $13 base + $7 mileage (flat) + $10 bonus = $30
   - Only applies within 10 miles with no headcount/food cost

3. **Dynamic Ready Set Fee** (`delivery-cost-calculator.ts`)
   - Added `readySetFeeMatchesDeliveryFee` flag to configuration
   - When enabled, Ready Set fee equals the customer tier-based delivery fee instead of a fixed amount

4. **Special Driver Mileage Settings** (`delivery-cost-calculator.ts`)
   - Added `driverMileageSettings` to configuration interface
   - Within 10 miles: Flat $7 driver mileage
   - Over 10 miles: Total miles x $0.70 (all miles, not just extra)

5. **Food Cost-Based Driver Pay Tiers** (`client-configurations.ts`)
   - Added `driverFoodCostPayTiers` to configuration interface
   - Used when headcount = 0 but food cost > 0
   - Mirrors headcount tiers but based on food cost ranges

### Flat Fee Pricing Model (January 2026)

**Commit:** `85fb6674` - Implement flat fee pricing and add calculator tests

- Changed HY Food Company (and Ready Set Standard) from within/beyond pricing to **flat fee pricing**
- `regularRate` now equals `within10Miles` for all tiers
- Mileage charges ($2.50/mi) only apply for miles OVER 10 (added separately)

### Comprehensive Test Coverage

**Commit:** `85fb6674` - Added `hy-food-company-pricing.test.ts`

- Tests verify all pricing tiers match between HY Food Company and Ready Set Standard
- Zero-order mode tests (Route #4 scenario)
- LESSER rule verification
- Daily drive discount tests
- Driver base pay tier tests (by headcount and food cost)
- Driver mileage calculation tests (flat $7 within 10mi, total x $0.70 over 10mi)

### Prior Calculator Foundation Changes

| Date | Commit | Description |
|---|---|---|
| Nov 2025 | `7ce6f643` | Added client configurations and tiered driver pay system (REA-41) |
| Nov 2025 | `82f37a86` | Implemented Destino driver compensation rules correctly |
| Nov 2025 | `ff5df857` | Updated CaterValley driver pay configuration |
| Jan 2026 | `85fb6674` | Implemented flat fee pricing model |
| Jan 2026 | `a9772c9b` | HY Food Company calculator implementation (Phase 1) |

---

## Code References

### Configuration

The HY Food Company configuration lives in:

```
src/lib/calculator/client-configurations.ts → HY_FOOD_COMPANY_DIRECT
```

Configuration ID used in the calculator: `hy-food-company-direct`

### Calculation Engine

Core calculation functions in:

```
src/lib/calculator/delivery-cost-calculator.ts
  ├── calculateDeliveryCost()  → Customer delivery fee
  ├── calculateDriverPay()     → Driver payment + Ready Set fee
  └── calculateMileagePay()    → Mileage-only calculation
```

### Service Layer

```
src/lib/calculator/calculator-service.ts → CalculatorService.calculate()
```

### API Endpoint

```
POST /api/calculator/calculate
```

### Tests

```
src/lib/calculator/__tests__/hy-food-company-pricing.test.ts
```

---

## FAQ

**Q: What happens when headcount = 0 and food cost = 0 but mileage > 10 miles?**
A: Zero-order mode does NOT apply. The system falls back to normal mode using the lowest tier (0-24 headcount / $0-$299 food cost = $60 delivery fee), and mileage over 10 miles is charged at $2.50/mile.

**Q: Does the LESSER rule apply to driver base pay?**
A: No. Driver base pay uses headcount tiers exclusively (when headcount > 0). Food cost tiers are only used when headcount = 0. The LESSER rule only applies to the customer delivery fee determination.

**Q: Why is the Ready Set fee dynamic for HY Food Company?**
A: The `readySetFeeMatchesDeliveryFee` flag is set to `true`, meaning the Ready Set fee scales with the order size (matching the customer tier fee). Other clients typically have a fixed Ready Set fee (e.g., $70).

**Q: Is there a driver pay cap for HY Food Company?**
A: No. `maxPayPerDrop` is set to `null`, meaning there is no cap on driver earnings per delivery. This differs from clients like Ready Set Standard and Try Hungry which have a $40 cap.

**Q: Does HY Food Company require manual review for large orders?**
A: No. Unlike Try Hungry (which requires manual review for 100+ headcount), HY Food Company supports all headcount ranges up to 299 automatically. Orders with 300+ headcount fall into the TBD tier.
