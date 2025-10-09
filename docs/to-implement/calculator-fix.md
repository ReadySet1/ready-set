# Fix Calculator with Actual Formulas from Coolfire Master Data

## Critical Issues Found:

1. **Two Different Mileage Rates**: Driver pays use $0.70/mile, Vendor pays use $3.00/mile
2. **Driver Pay Logic**: Simplified in actual data - just equals "Driver Max Pay Per Drop"
3. **Mileage Minimum**: Driver mileage pay has a $7.00 minimum
4. **Vendor Mileage Threshold**: Vendor only pays mileage after 10 miles
5. **Bonus Treatment**: $10 bonus is shown separately, NOT added to total driver pay

## You can use the CSV with raw data is here:
/Users/ealanis/Development/current-projects/ready-set/docs/to-implement/data-reference-calculator.csv

## Exact Formulas to Implement:

### 1. Vendor Pay (Ready Set Total Fee)

```typescript
interface VendorPayCalculation {
  readySetFee: number;          // Base delivery cost from tier table
  mileageCharges: number;       // Mileage charges (only if > 10 miles)
  readySetTotalFee: number;     // Total vendor payment
  tollFees?: number;            // Additional tolls if applicable
}

function calculateVendorPay(
  headcount: number,
  foodCost: number,
  totalMileage: number,
  isWithin10Miles: boolean
): VendorPayCalculation {
  // Step 1: Get base delivery fee from pricing tier (use LESSER value)
  const readySetFee = getDeliveryFeeFromTier(headcount, foodCost, isWithin10Miles);

  // Step 2: Calculate mileage charges - ONLY if beyond 10 miles
  const mileageCharges = totalMileage > 10
    ? (totalMileage - 10) * 3.00
    : 0.00;

  // Step 3: Calculate total
  const readySetTotalFee = readySetFee + mileageCharges;

  return {
    readySetFee,
    mileageCharges,
    readySetTotalFee
  };
}

// Helper function to get delivery fee from tier table
function getDeliveryFeeFromTier(
  headcount: number,
  foodCost: number,
  isWithin10Miles: boolean
): number {
  // Determine which tier to use (headcount vs food cost - use LOWER fee)
  const headcountFee = getFeeByCriteria(headcount, 'headcount', isWithin10Miles);
  const foodCostFee = getFeeByCriteria(foodCost, 'foodCost', isWithin10Miles);

  // Return the LESSER of the two fees
  return Math.min(headcountFee, foodCostFee);
}
```

**Pricing Tier Tables** (from images):

typescript

```typescript
// Regular Rate (> 10 miles)
const REGULAR_RATE_TIERS = [
  { headcount: [0, 24], foodCost: [0, 299.99], fee: 60 },
  { headcount: [25, 49], foodCost: [300, 599.99], fee: 70 },
  { headcount: [50, 74], foodCost: [600, 899.99], fee: 90 },
  { headcount: [75, 99], foodCost: [900, 1199.99], fee: 100 },
  { headcount: [100, 124], foodCost: [1200, 1499.99], fee: 120 },
  { headcount: [125, 149], foodCost: [1500, 1699.99], fee: 150 },
  { headcount: [150, 174], foodCost: [1700, 1899.99], fee: 180 },
  { headcount: [175, 199], foodCost: [1900, 2099.99], fee: 210 },
  { headcount: [200, 249], foodCost: [2100, 2299.99], fee: 280 },
  { headcount: [250, 299], foodCost: [2300, 2499.99], fee: 310 }
];

// Kasa Within 10 Miles Rate
const KASA_WITHIN_10_MILES_TIERS = [
  { headcount: [0, 24], foodCost: [0, 299.99], fee: 30 },
  { headcount: [25, 49], foodCost: [300, 599.99], fee: 40 },
  { headcount: [50, 74], foodCost: [600, 899.99], fee: 60 },
  { headcount: [75, 99], foodCost: [900, 1199.99], fee: 70 },
  { headcount: [100, 124], foodCost: [1200, 1499.99], fee: 80 },
  { headcount: [125, 149], foodCost: [1500, 1699.99], fee: 90 },
  { headcount: [150, 174], foodCost: [1700, 1899.99], fee: 100 },
  { headcount: [175, 199], foodCost: [1900, 2099.99], fee: 110 },
  { headcount: [200, 249], foodCost: [2100, 2299.99], fee: 120 },
  { headcount: [250, 299], foodCost: [2300, 2499.99], fee: 130 }
];
```

### 2. Driver Pay Calculation

typescript

```typescript
interface DriverPayCalculation {
  driverMaxPayPerDrop: number;    // Pre-determined max pay
  driverBasePayPerDrop: number;   // Base pay rate
  totalMileage: number;           // Total miles driven
  mileageRate: number;            // $0.70/mile
  totalMileagePay: number;        // Calculated mileage pay (min $7)
  driverTotalBasePay: number;     // Actual base pay (equals max in data)
  driverBonusPay: number;         // Bonus ($10, shown separately)
  totalDriverPay: number;         // Final driver payment
  bonusQualified: boolean;        // Whether 100% bonus qualified
}

function calculateDriverPay(
  totalMileage: number,
  driverBasePayPerDrop: number = 23.00,
  driverMaxPayPerDrop: number = 40.00
): DriverPayCalculation {
  // Constants
  const DRIVER_MILEAGE_RATE = 0.70;
  const DRIVER_MILEAGE_MINIMUM = 7.00;
  const DRIVER_BONUS = 10.00;

  // Step 1: Calculate mileage pay with $7 minimum
  const totalMileagePay = Math.max(
    totalMileage * DRIVER_MILEAGE_RATE,
    DRIVER_MILEAGE_MINIMUM
  );

  // Step 2: Driver Total Base Pay
  // NOTE: In actual data, this ALWAYS equals driverMaxPayPerDrop
  // The formula Base + Mileage (capped at Max) from images is NOT used in practice
  const driverTotalBasePay = driverMaxPayPerDrop;

  // Step 3: Bonus is separate - NOT added to total
  const driverBonusPay = DRIVER_BONUS;
  const bonusQualified = true; // 100% in all sample data

  // Step 4: Total Driver Pay = Total Base Pay (bonus shown separately)
  const totalDriverPay = driverTotalBasePay;

  return {
    driverMaxPayPerDrop,
    driverBasePayPerDrop,
    totalMileage,
    mileageRate: DRIVER_MILEAGE_RATE,
    totalMileagePay,
    driverTotalBasePay,
    driverBonusPay,
    totalDriverPay,
    bonusQualified
  };
}
```

### 3. Daily Drive Discount (from images - NOT seen in data)

typescript

```typescript
function calculateDailyDriveDiscount(numberOfDrives: number): number {
  if (numberOfDrives >= 4) return numberOfDrives * 15;
  if (numberOfDrives === 3) return numberOfDrives * 10;
  if (numberOfDrives === 2) return numberOfDrives * 5;
  return 0;
}
```

### 4. Complete Delivery Calculation

typescript

```typescript
interface DeliveryCalculation {
  // Input
  clientType: 'ready-set' | 'kasa';
  headcount: number;
  foodCost: number;
  totalMileage: number;
  numberOfDrives: number;

  // Vendor Pay
  vendorPay: VendorPayCalculation;

  // Driver Pay
  driverPay: DriverPayCalculation;

  // Discounts & Fees
  dailyDriveDiscount: number;
  finalDeliveryFee: number;
}

function calculateCompleteDelivery(
  clientType: 'ready-set' | 'kasa',
  headcount: number,
  foodCost: number,
  totalMileage: number,
  numberOfDrives: number = 1
): DeliveryCalculation {
  // Determine if within 10 miles (for Kasa pricing)
  const isWithin10Miles = totalMileage <= 10 && clientType === 'kasa';

  // Calculate vendor pay
  const vendorPay = calculateVendorPay(
    headcount,
    foodCost,
    totalMileage,
    isWithin10Miles
  );

  // Calculate driver pay
  const driverPay = calculateDriverPay(totalMileage);

  // Calculate daily drive discount (if applicable)
  const dailyDriveDiscount = calculateDailyDriveDiscount(numberOfDrives);

  // Final delivery fee
  const finalDeliveryFee = vendorPay.readySetTotalFee - dailyDriveDiscount;

  return {
    clientType,
    headcount,
    foodCost,
    totalMileage,
    numberOfDrives,
    vendorPay,
    driverPay,
    dailyDriveDiscount,
    finalDeliveryFee
  };
}
```

## Test Cases to Validate:

### Test 1: Standard Delivery (from actual data)

typescript

```typescript
// Record: Children's Council of SF
const test1 = calculateCompleteDelivery('ready-set', 40, 500, 6.4, 1);
// Expected:
// - Ready Set Fee: $70.00
// - Mileage Charges: $0.00 (< 10 miles)
// - Ready Set Total Fee: $70.00
// - Driver Mileage Pay: $7.00 (minimum applied: 6.4 × $0.70 = $4.48 < $7)
// - Driver Total Base Pay: $40.00
// - Total Driver Pay: $40.00
// - Driver Bonus: $10.00 (separate)
```

### Test 2: Long Distance (from actual data)

typescript

```typescript
// Record: EUV Tech
const test2 = calculateCompleteDelivery('ready-set', 50, 800, 37.5, 1);
// Expected:
// - Ready Set Fee: $90.00 (50-74 headcount)
// - Mileage Charges: (37.5 - 10) × $3.00 = $82.50
// - Ready Set Total Fee: $172.50
// - Driver Mileage Pay: 37.5 × $0.70 = $26.25
// - Driver Total Base Pay: $69.25 (special case - long distance)
// - Total Driver Pay: $69.25
// - Driver Bonus: $10.00 (separate)
```

### Test 3: Kasa Within 10 Miles (from Image 3)

typescript

```typescript
const test3 = calculateCompleteDelivery('kasa', 110, 1200, 9.0, 1);
// Expected:
// - Ready Set Fee: $80.00 (within 10 miles, 100-124 tier)
// - Mileage Charges: $0.00 (< 10 miles)
// - Ready Set Total Fee: $80.00
// - Driver Mileage Pay: $7.00 (9 × $0.70 = $6.30 < $7 minimum)
// - Total Driver Pay: $40.00
```

### Test 4: Multiple Drives with Discount (from Image 2)

typescript

```typescript
const test4 = calculateCompleteDelivery('ready-set', 243, 5000, 14.5, 4);
// Expected:
// - Ready Set Fee: $280.00 (200-249 headcount - lesser value)
// - Mileage Charges: (14.5 - 10) × $3.00 = $13.50
// - Subtotal: $293.50
// - Daily Drive Discount: 4 × $15 = $60.00
// - Final Delivery Fee: $233.50
```

## Critical Fixes Needed:

1. **Split mileage calculations**:
   - Driver rate: $0.70/mile with $7 minimum
   - Vendor rate: $3.00/mile only after 10 miles
2. **Simplify driver pay logic**:
   - Use `driverMaxPayPerDrop` directly as `driverTotalBasePay`
   - Don't try to calculate Base + Mileage formula from images
3. **Separate bonus display**:
   - Show $10 bonus but DON'T add to `totalDriverPay`
4. **Fix tier lookup**:
   - Must choose LESSER fee between headcount and food cost tiers
   - Must handle Kasa within/beyond 10 miles correctly
5. **Add proper TypeScript types** for all calculations with strict null checks
6. **Validate edge cases**:
   - Exactly 10 miles (should use within 10 miles rate)
   - Zero mileage (should use $7 minimum for driver)
   - Boundary values (e.g., 24 vs 25 headcount, $299.99 vs $300 food cost)

Please audit the existing calculator code, identify where these formulas differ from current implementation, and update with the correct logic. Ensure all TypeScript types are properly defined and all calculations match the test cases above.
