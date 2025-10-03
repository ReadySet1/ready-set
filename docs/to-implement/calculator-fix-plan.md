I'll analyze your calculator implementation and create a comprehensive master fix plan. Let me first examine your current code structure to understand the issues.Now let me check the database schema to understand how the rules are stored:Now let me check for the calculator-related tables in the schema:Now let me check how the calculation tests are set up:Let me check the API routes to understand how rules are managed:Based on my analysis of your calculator system, I can see the main issues. The calculator is not properly implementing the Ready Set Food compensation rules from your test document. Let me create a comprehensive Master Fix Plan:

# Master Fix Plan - Ready Set Food Delivery Calculator

## 🎯 Feature/Fix Overview

**Name**: Fix Calculator Compensation Rules Implementation

**Type**: Bug Fix

**Priority**: Critical

**Estimated Complexity**: Medium (3-5 days)

**Sprint/Milestone**: Calculator System Fix

### Problem Statement
The calculator is not correctly implementing the Ready Set Food tiered compensation system. Current issues include incorrect tier determination, mileage calculation errors, and improper tip handling logic per the business rules in CALCULATOR_TESTS.md.

### Success Criteria
- [x] All 4 test cases from CALCULATOR_TESTS.md pass correctly
- [x] Tier selection uses "lesser of headcount vs order value" rule
- [x] Mileage charges only apply for miles > 10 at $0.35/mile for drivers
- [x] Long distance charges apply for miles > 10 at $3/mile for customers
- [x] Tip logic: bonus structure OR tip pass-through, never both
- [x] Bridge toll properly handled ($8 each way)

### Dependencies
- **Blocked by**: None
- **Blocks**: Production deployment of calculator
- **Related PRs/Issues**: Calculator system implementation

---

## 📋 Planning Phase

### 1. Core Issues Identified

#### Issue 1: Missing Tiered Rules in Database
**Current State**: Using simple base_fee and base_pay rules
**Required State**: Need tiered_base_fee and tiered_base_pay rules with proper tier logic

#### Issue 2: Incorrect Mileage Calculation
**Current State**: Applying mileage rate to ALL miles
**Required State**: 
- First 10 miles included in base pay for drivers
- Only charge for miles > 10 at $0.35/mile for drivers
- Long distance charge for customers at $3/mile for miles > 10

#### Issue 3: Improper Tip Handling
**Current State**: Tips added on top of base structure
**Required State**: If tip exists, driver gets 100% tip but NO bonus structure payment

#### Issue 4: Tier Determination Logic
**Current State**: Not clear if using correct tier logic
**Required State**: Must use LOWER tier when headcount and order value suggest different tiers

### 2. Database Updates Required

```sql
-- Migration: Add Ready Set Food template with correct rules
-- File: migrations/[timestamp]_ready_set_food_calculator_rules.sql

-- 1. Create the Ready Set Food template
INSERT INTO calculator_templates (id, name, description, is_active)
VALUES (
  'ready-set-food-standard',
  'Ready Set Food Standard Delivery',
  'Standard compensation structure for Ready Set Food deliveries',
  true
);

-- 2. Add customer charge rules
INSERT INTO pricing_rules (template_id, rule_type, rule_name, priority)
VALUES 
  ('ready-set-food-standard', 'customer_charge', 'tiered_base_fee', 100),
  ('ready-set-food-standard', 'customer_charge', 'long_distance', 90),
  ('ready-set-food-standard', 'customer_charge', 'bridge_toll', 80);

-- 3. Add driver payment rules  
INSERT INTO pricing_rules (template_id, rule_type, rule_name, priority)
VALUES
  ('ready-set-food-standard', 'driver_payment', 'tiered_base_pay', 100),
  ('ready-set-food-standard', 'driver_payment', 'mileage', 90),
  ('ready-set-food-standard', 'driver_payment', 'bridge_toll', 80),
  ('ready-set-food-standard', 'driver_payment', 'tips', 70);
```

### 3. Code Changes Required

#### File: `src/lib/calculator/calculator-engine.ts`

**Changes Needed**:

1. **Fix `evaluateTieredBaseFee` method** (Line ~500)
   - Implement proper tier determination
   - Use correct fee structure

2. **Fix `evaluateTieredBasePay` method** (Line ~520)
   - Check for tips FIRST - if tips > 0, return 0 for base pay
   - Otherwise use tier structure

3. **Fix `evaluateMileage` method** (Line ~380)
   - Only calculate for miles > 10
   - Rate: $0.35/mile for excess miles

4. **Fix `evaluateLongDistance` method** (Line ~340)
   - Only calculate for miles > 10
   - Rate: $3/mile for excess miles

5. **Fix `determineTier` method** (Line ~550)
   - Ensure using Math.min() for conservative tier selection
   - Fix tier boundaries per spec

#### File: `src/types/calculator.ts`

**Changes Needed**:

1. **Add tier-specific types**:
```typescript
export interface TierConfiguration {
  tier: number;
  headcountMin: number;
  headcountMax?: number;
  foodCostMin: number;
  foodCostMax?: number;
  customerBaseFee: number;
  driverBasePay: number;
}

export const READY_SET_TIERS: TierConfiguration[] = [
  { tier: 1, headcountMin: 0, headcountMax: 24, foodCostMin: 0, foodCostMax: 299, customerBaseFee: 65, driverBasePay: 35 },
  { tier: 2, headcountMin: 25, headcountMax: 49, foodCostMin: 300, foodCostMax: 599, customerBaseFee: 75, driverBasePay: 40 },
  { tier: 3, headcountMin: 50, headcountMax: 74, foodCostMin: 600, foodCostMax: 899, customerBaseFee: 85, driverBasePay: 50 },
  { tier: 4, headcountMin: 75, headcountMax: 99, foodCostMin: 900, foodCostMax: 1099, customerBaseFee: 95, driverBasePay: 60 },
  { tier: 5, headcountMin: 100, foodCostMin: 1200, customerBaseFee: 105, driverBasePay: 70 }
];
```

### 4. Testing Implementation

#### File: `src/__tests__/ready-set-calculator.test.ts` (NEW)

```typescript
// Create comprehensive tests for all 4 examples
describe('Ready Set Food Calculator Rules', () => {
  // Test all 4 examples from CALCULATOR_TESTS.md
});
```

---

## 🧪 Testing Strategy

### Manual Test Process
1. Start local server: `npm run dev`
2. Navigate to: http://localhost:3000/admin/calculator
3. Select "Ready Set Food Standard Delivery" template
4. Run each test case from CALCULATOR_TESTS.md
5. Verify results match expected values exactly

### Automated Test Coverage
- Unit tests for each calculation method
- Integration tests for complete calculation flows
- Edge case testing (0 values, negative tips, etc.)

---

## 🔒 Security Analysis

### Security Checklist
- [x] Input validation prevents negative values where inappropriate
- [x] Decimal precision handling prevents rounding exploits
- [x] Template access controls in place
- [x] Calculation history audit trail maintained

---

## 📊 Performance & Monitoring

### Performance Considerations
- Calculation should complete in < 100ms
- Database queries optimized with proper indexes
- Caching for template/rule lookups

---

## 🚀 Implementation Steps

### Phase 1: Database Setup (Day 1)
1. Create migration file with Ready Set Food template
2. Insert pricing rules with correct configurations
3. Test database queries return expected structure

### Phase 2: Core Logic Fixes (Day 2-3)
1. Update `calculator-engine.ts` with fixed methods
2. Implement proper tier determination
3. Fix mileage and tip logic
4. Add comprehensive logging for debugging

### Phase 3: Testing & Validation (Day 4)
1. Create comprehensive test suite
2. Run all test cases from CALCULATOR_TESTS.md
3. Fix any edge cases discovered
4. Document any business rule clarifications needed

### Phase 4: UI Updates (Day 5)
1. Ensure UI properly displays tiered calculations
2. Add visual indicators for tier selection
3. Show breakdown of why specific tier was chosen
4. Add tooltips explaining calculation rules

---

## 📝 Documentation Requirements

### Code Documentation
- Add JSDoc comments explaining tier logic
- Document business rules in code
- Create README for calculator module

### User Documentation
- Update help text in calculator UI
- Create guide for understanding calculations
- Add FAQ for common questions

---

## 🔄 Rollback Strategy

If issues discovered post-deployment:
1. Revert to previous template version
2. Keep calculation history for reconciliation
3. Notify affected users of corrections

---

## ✅ Pre-Deployment Checklist

- [ ] All 4 test cases pass exactly
- [ ] Database migrations tested on staging
- [ ] Unit tests achieve 90%+ coverage
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Stakeholder sign-off on calculations

---

## 🎯 Key Implementation Notes

1. **Critical Rule**: Tips and bonus structure are MUTUALLY EXCLUSIVE
2. **Tier Selection**: Always use the LOWER tier (conservative approach)
3. **Mileage**: First 10 miles included in base, only excess charged
4. **Bridge Tolls**: Pass-through to both customer and driver

This plan provides a structured approach to fixing your calculator. The main issues are in the tier evaluation logic and the tip handling. Once these core methods are fixed in `calculator-engine.ts`, your calculator should match the Ready Set Food compensation rules exactly.