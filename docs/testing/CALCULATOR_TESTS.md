# Calculator Test Cases - Ready Set Food Delivery

Separate test suites for KASA (Client Pricing) and Destino (Driver Compensation) calculators.

---

## 🏢 KASA CALCULATOR - Client Pricing Tests

### Test K1: Small Order Within 10 Miles
**Scenario**: 20 people, $250 order, 8 miles, no tolls

**Input Parameters**:
- Headcount: `20`
- Food Cost: `250`
- Total Mileage: `8`
- Toll Fees: `0`

**Expected Results**:
- **Rate Type**: Within 10 Miles
- **Delivery Cost**: $30.00 (Tier: <$300 food cost)
- **Mileage Charge**: $0.00 (within 10 miles)
- **Toll Fees**: $0.00
- **Total Client Charge**: $30.00

**Notes**: Uses lower "Within 10 Miles" rate table, no mileage surcharge

---

### Test K2: Medium Order Slightly Over 10 Miles
**Scenario**: 35 people, $450 order, 12 miles, no tolls

**Input Parameters**:
- Headcount: `35`
- Food Cost: `450`
- Total Mileage: `12`
- Toll Fees: `0`

**Expected Results**:
- **Rate Type**: Regular Rate
- **Delivery Cost**: $70.00 (Tier: $300-599 food cost)
- **Mileage Charge**: $6.00 (2 miles × $3.00)
- **Toll Fees**: $0.00
- **Total Client Charge**: $76.00

**Breakdown**:
- Base: $70 (Regular Rate for $300-599)
- Long Distance: (12 - 10) × $3 = $6

---

### Test K3: Large Order With Tolls
**Scenario**: 100 people, $1200 order, 14.5 miles, $8 bridge toll

**Input Parameters**:
- Headcount: `100`
- Food Cost: `1200`
- Total Mileage: `14.5`
- Toll Fees: `8`

**Expected Results**:
- **Rate Type**: Regular Rate
- **Delivery Cost**: $100.00 (Tier: $1200-1499 food cost)
- **Mileage Charge**: $13.50 (4.5 miles × $3.00)
- **Toll Fees**: $8.00
- **Total Client Charge**: $121.50

**Breakdown**:
- Base: $100 (Regular Rate for $1200-1499)
- Long Distance: (14.5 - 10) × $3 = $13.50
- Bridge: $8

---

### Test K4: High Volume Within Range
**Scenario**: 200 people, $2100 order, 9 miles, no tolls

**Input Parameters**:
- Headcount: `200`
- Food Cost: `2100`
- Total Mileage: `9`
- Toll Fees: `0`

**Expected Results**:
- **Rate Type**: Within 10 Miles
- **Delivery Cost**: $120.00 (Tier: $2100-2299 food cost)
- **Mileage Charge**: $0.00 (within 10 miles)
- **Toll Fees**: $0.00
- **Total Client Charge**: $120.00

**Notes**: High value order but within 10 miles = lower rate structure

---

## 🚗 DESTINO CALCULATOR - Driver Compensation Tests

### Test D1: Basic Delivery No Bonus Deductions
**Scenario**: 28 people, $400 order, 3.1 miles, no tips, no infractions

**Input Parameters**:
- Headcount: `28`
- Food Cost: `400`
- Total Mileage: `3.1`
- Direct Tip: `No`
- Tip Amount: `0`
- Weekly Infractions: `None`

**Expected Results**:
- **Base Pay**: $30.00 (Tier: 25-49 headcount)
- **Mileage Pay**: $1.09 (3.1 miles × $0.35)
- **Bonus**: $10.00 (100% qualified)
- **Direct Tip**: $0.00
- **Total Driver Pay**: $41.09

**Notes**: All mileage paid at $0.35/mile (not just over 10 miles)

---

### Test D2: Order Value Limits Tier (Lesser Rule)
**Scenario**: 60 people, $500 order, 20 miles, no tips, no infractions

**Input Parameters**:
- Headcount: `60`
- Food Cost: `500`
- Total Mileage: `20`
- Direct Tip: `No`
- Tip Amount: `0`
- Weekly Infractions: `None`

**Expected Results**:
- **Base Pay**: $40.00 (Tier: $300-599 food cost - LESSER)
- **Mileage Pay**: $7.00 (20 miles × $0.35)
- **Bonus**: $10.00 (100% qualified)
- **Direct Tip**: $0.00
- **Total Driver Pay**: $57.00

**Breakdown**:
- Headcount suggests Tier 3 ($50)
- Food cost suggests Tier 2 ($40)
- Use LESSER = $40

---

### Test D3: With Direct Tip - NO BASE PAY
**Scenario**: 30 people, $400 order, 15 miles, $20 direct tip, no infractions

**Input Parameters**:
- Headcount: `30`
- Food Cost: `400`
- Total Mileage: `15`
- Direct Tip: `Yes`
- Tip Amount: `20`
- Weekly Infractions: `None`

**Expected Results**:
- **Base Pay**: $0.00 (❌ EXCLUDED due to tip)
- **Mileage Pay**: $5.25 (15 miles × $0.35)
- **Bonus**: $0.00 (❌ EXCLUDED due to tip)
- **Direct Tip**: $20.00 (✅ 100% to driver)
- **Total Driver Pay**: $25.25

**🚨 CRITICAL RULE**: Direct tip = NO base pay, NO bonus. Only tip + mileage.

---

### Test D4: With Weekly Infractions
**Scenario**: 50 people, $700 order, 10 miles, no tip, 1 late (>15min), 1 no photo

**Input Parameters**:
- Headcount: `50`
- Food Cost: `700`
- Total Mileage: `10`
- Direct Tip: `No`
- Tip Amount: `0`
- Weekly Infractions:
  - No Photo Setup: `1` (-5%)
  - Late Over 15 Min: `1` (-10%)

**Expected Results**:
- **Base Pay**: $50.00 (Tier: 50-74 headcount)
- **Mileage Pay**: $3.50 (10 miles × $0.35)
- **Bonus**: $8.50 ($10 × 85% = $8.50)
- **Bonus Percentage**: 85% (100% - 5% - 10%)
- **Direct Tip**: $0.00
- **Total Driver Pay**: $62.00

**Breakdown**:
- Base: $50
- Mileage: 10 × $0.35 = $3.50
- Bonus: $10 × 0.85 = $8.50
- Total: $62.00

---

### Test D5: High Volume Basic
**Scenario**: 100 people, $1500 order, 25 miles, no tip, no infractions

**Input Parameters**:
- Headcount: `100`
- Food Cost: `1500`
- Total Mileage: `25`
- Direct Tip: `No`
- Tip Amount: `0`
- Weekly Infractions: `None`

**Expected Results**:
- **Base Pay**: $50.00 (Case by case - using Tier 4 estimate)
- **Mileage Pay**: $8.75 (25 miles × $0.35)
- **Bonus**: $10.00 (100% qualified)
- **Direct Tip**: $0.00
- **Total Driver Pay**: $68.75

**Notes**: Over 100 headcount is "case by case" - using estimated Tier 4 rate

---

## 📊 Tier Reference Tables

### KASA Client Pricing Tiers

#### Within 10 Miles
| Headcount | Food Cost | Base Fee |
|-----------|-----------|----------|
| ≤24 | <$300 | $30 |
| 25-49 | $300-599 | $40 |
| 50-74 | $600-899 | $60 |
| 75-99 | $900-1199 | $70 |
| 100-124 | $1200-1499 | $80 |
| 125-149 | $1500-1699 | $90 |
| 150-174 | $1700-1899 | $100 |
| 175-199 | $1900-2099 | $110 |
| 200-249 | $2100-2299 | $120 |
| 250-299 | $2300-2499 | $130 |

#### Regular Rate (>10 Miles)
| Headcount | Food Cost | Base Fee |
|-----------|-----------|----------|
| ≤24 | <$300 | $60 |
| 25-49 | $300-599 | $70 |
| 50-74 | $600-899 | $90 |
| 75-99 | $900-1199 | $100 |
| 100-124 | $1200-1499 | $120 |
| 125-149 | $1500-1699 | $150 |
| 150-174 | $1700-1899 | $180 |
| 175-199 | $1900-2099 | $210 |
| 200-249 | $2100-2299 | $280 |
| 250-299 | $2300-2499 | $310 |

### Destino Driver Compensation Tiers

| Headcount | Food Cost | Base Pay |
|-----------|-----------|----------|
| <25 | <$300 | $25 |
| 25-49 | $300-599 | $30 |
| 50-74 | $600-899 | $40 |
| 75-99 | $900-1099 | $50 |
| 100+ | $1200+ | $50+ (case by case) |

---

## 🔑 Key Calculation Rules

### KASA (Client)
- ✅ Use LESSER tier (headcount vs food cost)
- ✅ Within 10 miles = lower rate table, no mileage charge
- ✅ Over 10 miles = higher rate table + $3/mile for excess
- ✅ Tolls passed through at cost

### Destino (Driver)
- ✅ Use LESSER tier (headcount vs food cost)
- ✅ ALL mileage paid at $0.35/mile (not just over 10)
- ✅ $10 bonus standard (affected by infractions)
- ✅ Direct tip = NO base pay, NO bonus (mutually exclusive)
- ✅ Infractions cumulative across entire week

---

## 🧪 Browser Console Test Script

```typescript
// KASA Calculator Tests
const kasaTests = [
  {
    name: "K1: Small Within 10",
    input: { headcount: 20, foodCost: 250, mileage: 8, tolls: 0 },
    expected: { total: 30.00 }
  },
  {
    name: "K2: Medium Over 10",
    input: { headcount: 35, foodCost: 450, mileage: 12, tolls: 0 },
    expected: { total: 76.00 }
  },
  {
    name: "K3: Large With Tolls",
    input: { headcount: 100, foodCost: 1200, mileage: 14.5, tolls: 8 },
    expected: { total: 121.50 }
  },
  {
    name: "K4: High Volume Within",
    input: { headcount: 200, foodCost: 2100, mileage: 9, tolls: 0 },
    expected: { total: 120.00 }
  }
];

// Destino Calculator Tests
const destinoTests = [
  {
    name: "D1: Basic No Deductions",
    input: { headcount: 28, foodCost: 400, mileage: 3.1, tip: 0, infractions: {} },
    expected: { total: 41.09 }
  },
  {
    name: "D2: Lesser Rule",
    input: { headcount: 60, foodCost: 500, mileage: 20, tip: 0, infractions: {} },
    expected: { total: 57.00 }
  },
  {
    name: "D3: Direct Tip",
    input: { headcount: 30, foodCost: 400, mileage: 15, tip: 20, infractions: {} },
    expected: { total: 25.25 }
  },
  {
    name: "D4: With Infractions",
    input: { headcount: 50, foodCost: 700, mileage: 10, tip: 0, infractions: { noPhoto: 1, late15: 1 } },
    expected: { total: 62.00 }
  }
];

console.log('🧪 Test cases ready!');
console.log('Run kasaTests or destinoTests to see expected values');
```