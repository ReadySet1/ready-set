// Calculator Engine - Core calculation logic for the flexible delivery calculator system
// Handles rule evaluation, pricing calculation, and result generation

import { 
  PricingRule, 
  CalculationInput, 
  CalculationResult, 
  CustomerCharges, 
  DriverPayments,
  RuleContext,
  RuleEvaluator,
  RuleEvaluators,
  RuleName,
  CalculatorError,
  RuleEvaluationError,
  DEFAULT_BRIDGE_TOLL,
  LONG_DISTANCE_THRESHOLD,
  LONG_DISTANCE_RATE,
  ClientConfiguration,
  READY_SET_TIERS,
  TierConfiguration
} from '@/types/calculator';

export class CalculatorEngine {
  private rules: Map<string, PricingRule[]>;
  private ruleEvaluators: RuleEvaluators;
  private clientConfig?: ClientConfiguration;

  constructor(rules: PricingRule[], clientConfig?: ClientConfiguration) {
    this.rules = this.groupRulesByType(rules);
    this.clientConfig = clientConfig;
    this.ruleEvaluators = this.buildRuleEvaluators();
  }

  /**
   * Groups pricing rules by type and sorts by priority
   */
  private groupRulesByType(rules: PricingRule[]): Map<string, PricingRule[]> {
    const grouped = new Map<string, PricingRule[]>();
    
    rules.forEach(rule => {
      const key = rule.ruleType;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(rule);
    });
    
    // Sort by priority (higher priority first)
    grouped.forEach(ruleList => {
      ruleList.sort((a, b) => b.priority - a.priority);
    });
    
    return grouped;
  }

  /**
   * Builds rule evaluators for different rule types
   */
  private buildRuleEvaluators(): RuleEvaluators {
    return {
      base_fee: this.evaluateBaseFee.bind(this),
      tiered_base_fee: this.evaluateTieredBaseFee.bind(this),
      long_distance: this.evaluateLongDistance.bind(this),
      bridge_toll: this.evaluateBridgeToll.bind(this),
      extra_stops: this.evaluateExtraStops.bind(this),
      headcount_adjustment: this.evaluateHeadcountAdjustment.bind(this),
      food_cost: this.evaluateFoodCost.bind(this),
      base_pay: this.evaluateBasePay.bind(this),
      tiered_base_pay: this.evaluateTieredBasePay.bind(this),
      mileage: this.evaluateMileage.bind(this),
      tips: this.evaluateTips.bind(this),
      driver_bonus: this.evaluateDriverBonus.bind(this)
    };
  }

  /**
   * Main calculation method
   */
  public calculate(input: CalculationInput): CalculationResult {
    try {
      // Validate input
      this.validateInput(input);

      // Apply client configuration overrides if available
      const adjustedInput = this.applyClientOverrides(input);

      // Calculate customer charges and driver payments
      const customerCharges = this.calculateCustomerCharges(adjustedInput);
      const driverPayments = this.calculateDriverPayments(adjustedInput);

      // Calculate profit metrics
      const profit = customerCharges.total - driverPayments.total;
      const profitMargin = customerCharges.total > 0 
        ? (profit / customerCharges.total) * 100 
        : 0;

      return {
        customerCharges,
        driverPayments,
        profit,
        profitMargin,
        calculatedAt: new Date(),
        templateUsed: this.getTemplateId(),
        configUsed: this.clientConfig?.id
      };
    } catch (error) {
      if (error instanceof CalculatorError) {
        throw error;
      }
      throw new CalculatorError(
        'Failed to calculate delivery pricing', 
        'CALCULATION_ERROR', 
        { originalError: error, input }
      );
    }
  }

  /**
   * Validates calculation input
   */
  private validateInput(input: CalculationInput): void {
    if (input.mileage < 0) {
      throw new CalculatorError('Mileage cannot be negative', 'INVALID_INPUT');
    }
    if (input.numberOfStops < 1) {
      throw new CalculatorError('Must have at least 1 stop', 'INVALID_INPUT');
    }
    if (input.headcount < 0) {
      throw new CalculatorError('Headcount cannot be negative', 'INVALID_INPUT');
    }
  }

  /**
   * Applies client-specific rule overrides
   */
  private applyClientOverrides(input: CalculationInput): CalculationInput {
    if (!this.clientConfig?.ruleOverrides) {
      return input;
    }

    const overrides = this.clientConfig.ruleOverrides as Record<string, any>;
    return {
      ...input,
      ...overrides
    };
  }

  /**
   * Calculates customer charges using applicable rules
   */
  private calculateCustomerCharges(input: CalculationInput): CustomerCharges {
    const rules = this.rules.get('customer_charge') || [];
    let charges: CustomerCharges = {
      baseFee: 0,
      longDistanceCharge: 0,
      bridgeToll: 0,
      extraStopsCharge: 0,
      headcountCharge: 0,
      foodCost: 0, // Don't include food cost in customer charges for Ready Set Food
      customCharges: {},
      subtotal: 0,
      total: 0
    };

    const context: RuleContext = {
      input,
      currentCharges: charges,
      currentPayments: {},
      clientConfig: this.clientConfig
    };

    // Apply each rule
    rules.forEach(rule => {
      try {
        const ruleAmount = this.evaluateRule(rule, context);
        this.applyCustomerRule(rule, ruleAmount, charges);
      } catch (error) {
        throw new RuleEvaluationError(rule.ruleName, { rule, error });
      }
    });

    // Calculate subtotal (excluding food cost for Ready Set Food calculator)
    charges.subtotal = 
      charges.baseFee + 
      charges.longDistanceCharge + 
      charges.extraStopsCharge + 
      charges.headcountCharge +
      Object.values(charges.customCharges).reduce((sum, val) => sum + val, 0);

    // Add tips to customer total if present (tip pass-through)
    const tipPassthrough = input.tips || 0;
    charges.total = charges.subtotal + charges.bridgeToll + tipPassthrough;

    return charges;
  }

  /**
   * Calculates driver payments using applicable rules
   */
  private calculateDriverPayments(input: CalculationInput): DriverPayments {
    const rules = this.rules.get('driver_payment') || [];
    let payments: DriverPayments = {
      basePay: 0,
      mileagePay: 0,
      bridgeToll: 0,
      extraStopsBonus: 0,
      tips: 0, // Tips will be set by the tips rule evaluation
      adjustments: input.adjustments || 0,
      customPayments: {},
      subtotal: 0,
      total: 0
    };

    const context: RuleContext = {
      input,
      currentCharges: {},
      currentPayments: payments,
      clientConfig: this.clientConfig
    };

    // Apply each rule
    rules.forEach(rule => {
      try {
        const ruleAmount = this.evaluateRule(rule, context);
        this.applyDriverRule(rule, ruleAmount, payments);
      } catch (error) {
        throw new RuleEvaluationError(rule.ruleName, { rule, error });
      }
    });

    // ⚠️ VALIDATION: Ensure tip exclusivity is enforced
    const hasTips = payments.tips > 0;
    if (hasTips && payments.basePay > 0) {
      console.warn('🚨 Tip exclusivity violation detected! Resetting base pay to 0');
      payments.basePay = 0;
    }

    // Calculate totals
    payments.subtotal = 
      payments.basePay + 
      payments.mileagePay + 
      payments.extraStopsBonus +
      Object.values(payments.customPayments).reduce((sum, val) => sum + val, 0);

    payments.total = 
      payments.subtotal + 
      payments.bridgeToll + 
      payments.tips + 
      payments.adjustments;

    return payments;
  }

  /**
   * Evaluates a single rule and returns the calculated amount
   */
  private evaluateRule(rule: PricingRule, context: RuleContext): number {
    // Check if rule applies based on appliesWhen conditions
    if (rule.appliesWhen && !this.evaluateAppliesWhen(rule.appliesWhen, context)) {
      return 0; // Rule doesn't apply
    }

    const evaluator = this.ruleEvaluators[rule.ruleName as RuleName];
    
    if (!evaluator) {
      // For custom rules, use generic evaluation
      return this.evaluateGenericRule(rule, context);
    }

    return evaluator(rule, context);
  }

  /**
   * Evaluates appliesWhen JSON conditions
   */
  private evaluateAppliesWhen(appliesWhen: any, context: RuleContext): boolean {
    if (!appliesWhen) return true;

    const { input } = context;

    // Handle single condition
    if (appliesWhen.condition) {
      return this.evaluateCondition(appliesWhen, input);
    }

    // Handle multiple conditions with logic
    if (appliesWhen.conditions && Array.isArray(appliesWhen.conditions)) {
      const results = appliesWhen.conditions.map((cond: any) => this.evaluateCondition(cond, input));
      
      if (appliesWhen.logic === 'AND') {
        return results.every((r: boolean) => r);
      } else if (appliesWhen.logic === 'OR') {
        return results.some((r: boolean) => r);
      }
    }

    return true; // Default to true if condition format not recognized
  }

  /**
   * Evaluates a single condition
   */
  private evaluateCondition(condition: any, input: CalculationInput): boolean {
    const { condition: field, operator, value, min, max } = condition;
    
    let inputValue: number;
    switch (field) {
      case 'headcount':
        inputValue = input.headcount || 0;
        break;
      case 'foodCost':
        inputValue = input.foodCost || 0;
        break;
      case 'mileage':
        inputValue = input.mileage || 0;
        break;
      case 'tip':
        inputValue = input.tips || 0;
        break;
      default:
        return false;
    }

    switch (operator) {
      case '<':
        return inputValue < value;
      case '>':
        return inputValue > value;
      case '<=':
        return inputValue <= value;
      case '>=':
        return inputValue >= value;
      case '==':
        return inputValue === value;
      case 'between':
        return inputValue >= min && inputValue <= max;
      default:
        return false;
    }
  }

  /**
   * Applies customer charge rule result
   */
  private applyCustomerRule(rule: PricingRule, amount: number, charges: CustomerCharges): void {
    switch (rule.ruleName) {
      case 'base_fee':
      case 'tiered_base_fee':
        charges.baseFee = amount;
        break;
      case 'long_distance':
        charges.longDistanceCharge = amount;
        break;
      case 'bridge_toll':
        charges.bridgeToll = amount;
        break;
      case 'extra_stops':
        charges.extraStopsCharge = amount;
        break;
      case 'headcount_adjustment':
        charges.headcountCharge = amount;
        break;
      default:
        charges.customCharges[rule.ruleName] = amount;
    }
  }

  /**
   * Applies driver payment rule result
   */
  private applyDriverRule(rule: PricingRule, amount: number, payments: DriverPayments): void {
    switch (rule.ruleName) {
      case 'base_pay':
      case 'tiered_base_pay':
        payments.basePay = amount;
        break;
      case 'mileage':
        payments.mileagePay = amount;
        break;
      case 'bridge_toll':
        payments.bridgeToll = amount;
        break;
      case 'extra_stops':
        payments.extraStopsBonus = amount;
        break;
      case 'tips':
        payments.tips = amount;
        break;
      case 'tip_passthrough':
        payments.tips = amount;
        break;
      default:
        payments.customPayments[rule.ruleName] = amount;
    }
  }

  // Rule Evaluators

  private evaluateBaseFee(rule: PricingRule, context: RuleContext): number {
    return rule.baseAmount || 0;
  }

  private evaluateLongDistance(rule: PricingRule, context: RuleContext): number {
    const { mileage } = context.input;
    const threshold = rule.thresholdValue || LONG_DISTANCE_THRESHOLD;
    const rate = rule.perUnitAmount || LONG_DISTANCE_RATE;

    if (mileage > threshold) {
      const extraMiles = mileage - threshold;
      return extraMiles * rate;
    }
    return 0;
  }

  private evaluateBridgeToll(rule: PricingRule, context: RuleContext): number {
    const { requiresBridge } = context.input;
    return requiresBridge ? (rule.baseAmount || DEFAULT_BRIDGE_TOLL) : 0;
  }

  private evaluateExtraStops(rule: PricingRule, context: RuleContext): number {
    const { numberOfStops } = context.input;
    const rate = rule.perUnitAmount || 0;
    
    if (numberOfStops > 1) {
      const extraStops = numberOfStops - 1;
      return extraStops * rate;
    }
    return 0;
  }

  private evaluateHeadcountAdjustment(rule: PricingRule, context: RuleContext): number {
    const { headcount } = context.input;
    const rate = rule.perUnitAmount || 0;
    return headcount * rate;
  }

  private evaluateFoodCost(rule: PricingRule, context: RuleContext): number {
    return context.input.foodCost || 0;
  }

  private evaluateBasePay(rule: PricingRule, context: RuleContext): number {
    // Use driver-specific rate if provided, otherwise use rule default
    return context.input.driverBaseRate || rule.baseAmount || 0;
  }

  private evaluateMileage(rule: PricingRule, context: RuleContext): number {
    const { mileage, mileageRate } = context.input;
    const threshold = rule.thresholdValue || 10; // First 10 miles included in base pay
    const rate = mileageRate || rule.perUnitAmount || 0.35; // Ready Set Food rate: $0.35/mile
    
    // Only charge for miles beyond the threshold (> 10 miles)
    if (mileage > threshold) {
      const extraMiles = mileage - threshold;
      return extraMiles * rate;
    }
    return 0;
  }

  private evaluateTips(rule: PricingRule, context: RuleContext): number {
    return context.input.tips || 0;
  }

  private evaluateDriverBonus(rule: PricingRule, context: RuleContext): number {
    // Custom bonus logic can be implemented here
    return rule.baseAmount || 0;
  }

  /**
   * Generic rule evaluator for custom rules
   */
  private evaluateGenericRule(rule: PricingRule, context: RuleContext): number {
    // Basic rule evaluation logic
    let amount = rule.baseAmount || 0;
    
    if (rule.perUnitAmount && rule.thresholdValue) {
      const threshold = rule.thresholdValue;
      const inputValue = this.getInputValueForRule(rule, context);
      
      switch (rule.thresholdType) {
        case 'above':
          if (inputValue > threshold) {
            amount += (inputValue - threshold) * rule.perUnitAmount;
          }
          break;
        case 'below':
          if (inputValue < threshold) {
            amount += (threshold - inputValue) * rule.perUnitAmount;
          }
          break;
        case 'between':
          // Would need additional logic for between ranges
          break;
      }
    }
    
    return amount;
  }

  /**
   * Gets input value for generic rule evaluation
   */
  private getInputValueForRule(rule: PricingRule, context: RuleContext): number {
    // Map rule names to input properties
    const inputMap: Record<string, keyof CalculationInput> = {
      mileage: 'mileage',
      headcount: 'headcount',
      stops: 'numberOfStops',
      food_cost: 'foodCost'
    };
    
    const inputKey = inputMap[rule.ruleName];
    return inputKey ? (context.input[inputKey] as number) || 0 : 0;
  }

  /**
   * Evaluates tiered base fee for customers based on Ready Set compensation rules
   */
  private evaluateTieredBaseFee(rule: PricingRule, context: RuleContext): number {
    const tier = this.determineTier(context.input);
    const tierConfig = READY_SET_TIERS.find(t => t.tier === tier);
    return tierConfig?.customerBaseFee || READY_SET_TIERS[0]?.customerBaseFee || 65;
  }

  /**
   * Evaluates tiered base pay for drivers based on Ready Set compensation rules
   * KEY RULE: If tips exist, driver gets ONLY (tip + mileage), NO base pay
   */
  private evaluateTieredBasePay(rule: PricingRule, context: RuleContext): number {
    // ⚠️ CRITICAL: Check tip exclusivity rule first
    const hasTips = (context.input.tips || 0) > 0;
    
    if (hasTips) {
      // When tips exist, driver gets ONLY tip + mileage (NO base pay)
      return 0;
    }

    // Only calculate base pay when NO tips present
    const tier = this.determineTier(context.input);
    const tierConfig = READY_SET_TIERS.find(t => t.tier === tier);
    return tierConfig?.driverBasePay || READY_SET_TIERS[0]?.driverBasePay || 35;
  }

  /**
   * Determines the appropriate tier based on headcount and food cost
   * Uses the "lesser of headcount vs order value" rule (conservative approach)
   */
  private determineTier(input: CalculationInput): number {
    const { headcount = 0, foodCost = 0 } = input;
    
    // Determine tier by headcount using Ready Set Food tier boundaries
    let headcountTier = 1;
    for (const tier of READY_SET_TIERS) {
      if (headcount >= tier.headcountMin && 
          (tier.headcountMax === undefined || headcount <= tier.headcountMax)) {
        headcountTier = tier.tier;
        break;
      }
    }
    
    // Determine tier by food cost using Ready Set Food tier boundaries
    let foodCostTier = 1;
    for (const tier of READY_SET_TIERS) {
      if (foodCost >= tier.foodCostMin && 
          (tier.foodCostMax === undefined || foodCost <= tier.foodCostMax)) {
        foodCostTier = tier.tier;
        break;
      }
    }
    
    // Return the LOWER tier (more conservative approach per Ready Set Food rules)
    const selectedTier = Math.min(headcountTier, foodCostTier);
    
    // Ensure we return a valid tier (fallback to tier 1)
    return selectedTier >= 1 && selectedTier <= 5 ? selectedTier : 1;
  }

  /**
   * Gets the template ID from rules
   */
  private getTemplateId(): string {
    const allRules = Array.from(this.rules.values()).flat();
    const templateId = allRules.length > 0 ? allRules[0]?.templateId || 'unknown' : 'unknown';
    return templateId;
  }

  /**
   * Gets available rule types
   */
  public getRuleTypes(): string[] {
    return Array.from(this.rules.keys());
  }

  /**
   * Gets rules for a specific type
   */
  public getRulesForType(ruleType: string): PricingRule[] {
    return this.rules.get(ruleType) || [];
  }

  /**
   * Updates client configuration
   */
  public updateClientConfig(config: ClientConfiguration): void {
    this.clientConfig = config;
  }
}
