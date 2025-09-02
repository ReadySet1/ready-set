# Calculator Test Cases - Ready Set Food Delivery

Test these examples to verify the calculator matches the compensation rules exactly.

## Server Info
🌐 **Calculator URL**: http://localhost:3000/admin/calculator

---

## Test Cases

### ✅ Test 1: Example 1 (Easy)
**Scenario**: 20 people, $250 order, 8 miles, no bridge, no tip

**Input Parameters**:
- Headcount: `20`
- Food Cost: `250`
- Mileage: `8`
- Bridge Required: `No`
- Number of Stops: `1`
- Tips: `0`

**Expected Results**:
- **Customer Total**: ~$65 (Tier 1 base fee)
- **Driver Total**: $35 (Tier 1 base pay - both headcount and order qualify for Tier 1)
- **Profit**: ~$30
- **Notes**: $35 base payment includes first 10 miles, no mileage charge needed

---

### ✅ Test 2: Example 2 (Normal)
**Scenario**: 35 people, $450 order, 12 miles, no bridge, no tip

**Input Parameters**:
- Headcount: `35`
- Food Cost: `450`
- Mileage: `12`
- Bridge Required: `No`
- Number of Stops: `1`
- Tips: `0`

**Expected Results**:
- **Customer Total**: $81 ($75 base + $6 long distance)
- **Driver Total**: $40.70 ($40 base + $0.70 mileage)
- **Profit**: ~$40
- **Breakdown**:
  - Customer: $75 Tier 2 base + $6 long distance (2 miles × $3)
  - Driver: $40 Tier 2 base + $0.70 mileage (2 miles × $0.35)

---

### ✅ Test 3: Example 3 (Complex)
**Scenario**: 60 people, $500 order, 20 miles, bridge crossing, no tip

**Input Parameters**:
- Headcount: `60`
- Food Cost: `500`
- Mileage: `20`
- Bridge Required: `Yes`
- Number of Stops: `1`
- Tips: `0`

**Expected Results**:
- **Customer Total**: $113 ($75 base + $30 long distance + $8 bridge)
- **Driver Total**: $51.50 ($40 base + $3.50 mileage + $8 bridge)
- **Profit**: ~$61.50
- **Breakdown**:
  - Customer: $75 Tier 2 base (by order value) + $30 long distance (10 miles × $3) + $8 bridge
  - Driver: $40 Tier 2 base (by order value) + $3.50 mileage (10 miles × $0.35) + $8 bridge
- **Key Rule**: Uses Tier 2 due to order value $500 (lesser of headcount vs order value rule)

---

### ✅ Test 4: Example 4 (With Direct Tip)
**Scenario**: 30 people, $400 order, 15 miles, $20 tip

**Input Parameters**:
- Headcount: `30`
- Food Cost: `400`
- Mileage: `15`
- Bridge Required: `No`
- Number of Stops: `1`
- Tips: `20`

**Expected Results**:
- **Customer Total**: $96.75 ($75 base + $15 long distance + $20 tip)
- **Driver Total**: $21.75 ($20 tip + $1.75 mileage only)
- **Profit**: ~$75
- **Breakdown**:
  - Customer: $75 Tier 2 base + $15 long distance (5 miles × $3) + $20 tip = $110
  - Driver: $20 tip + $1.75 mileage (5 miles × $0.35) = $21.75
- **Key Rule**: With direct tip, driver gets 100% tip but NO bonus structure payment

---

## Browser Console Test Script

Open the calculator page and paste this in the browser console to test all scenarios:

```javascript
// Test Calculator via Browser Console
const testExamples = [
  {
    name: "Example 1 (Easy)",
    input: { headcount: 20, foodCost: 250, mileage: 8, requiresBridge: false, numberOfStops: 1, tips: 0 },
    expected: { customer: 65, driver: 35 }
  },
  {
    name: "Example 2 (Normal)", 
    input: { headcount: 35, foodCost: 450, mileage: 12, requiresBridge: false, numberOfStops: 1, tips: 0 },
    expected: { customer: 81, driver: 40.70 }
  },
  {
    name: "Example 3 (Complex)",
    input: { headcount: 60, foodCost: 500, mileage: 20, requiresBridge: true, numberOfStops: 1, tips: 0 },
    expected: { customer: 113, driver: 51.50 }
  },
  {
    name: "Example 4 (With Tip)",
    input: { headcount: 30, foodCost: 400, mileage: 15, requiresBridge: false, numberOfStops: 1, tips: 20 },
    expected: { customer: 110, driver: 21.75 }
  }
];

async function runBrowserTests() {
  console.log('🧪 Starting Calculator Tests...\n');
  
  for (const test of testExamples) {
    console.log(`\n📋 Testing: ${test.name}`);
    console.log('Input:', test.input);
    console.log('Expected - Customer:', `$${test.expected.customer}`, 'Driver:', `$${test.expected.driver}`);
    
    // You would manually enter these values in the UI and compare results
    console.log('👆 Enter these values in the calculator and check results');
  }
}

// Run the test
runBrowserTests();
```

---

## Manual Testing Steps

1. **Open Calculator**: Navigate to http://localhost:3000/admin/calculator
2. **For each test case**:
   - Enter the input parameters in the calculator form
   - Click "Calculate" 
   - Compare results with expected values
   - Note any discrepancies

3. **Key Things to Verify**:
   - ✅ Tier selection (based on lesser of headcount vs order value)
   - ✅ Mileage calculation (only for miles > 10 at $0.35/mile)
   - ✅ Bridge toll handling ($8 each way)
   - ✅ Tip logic (either bonus structure OR tip pass-through, never both)
   - ✅ Long distance charges ($3/mile for miles > 10)

---

## Expected Tier Logic

| Headcount | Order Value | Customer Base | Driver Base |
|-----------|-------------|---------------|-------------|
| < 25 | < $300 | $65 | $35 |
| 25-49 | $300-599 | $75 | $40 |
| 50-74 | $600-899 | $85 | $50 |
| 75-99 | $900-1099 | $95 | $60 |
| > 100 | > $1200 | $105 | $70 |

**Rule**: Uses the LOWER tier when headcount and order value suggest different tiers.
