// Calculator Service - Business logic for calculator system operations
// Handles CRUD operations for templates, rules, configurations, and calculations

import type { 
  CalculatorTemplate, 
  PricingRule, 
  ClientConfiguration,
  CreateClientConfigInput,
  CalculationInput,
  CalculationResult,
  CustomerCharges,
  DriverPayments,
  ConfigurationError
} from '@/types/calculator';

export class CalculatorService {

  /**
   * Get all calculator templates
   */
  static async getTemplates(supabase: any): Promise<CalculatorTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('calculator_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching templates:', error);
        throw new Error('Failed to fetch calculator templates');
      }

      return data || [];
    } catch (error) {
      console.error('Error in getTemplates:', error);
      throw error;
    }
  }

  /**
   * Get template with its pricing rules
   */
  static async getTemplateWithRules(supabase: any, templateId: string): Promise<CalculatorTemplate | null> {
    try {
      const { data: template, error: templateError } = await supabase
        .from('calculator_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError || !template) {
        console.error('Error fetching template:', templateError);
        return null;
      }

      const { data: rules, error: rulesError } = await supabase
        .from('pricing_rules')
        .select('*')
        .eq('template_id', templateId)
        .order('priority', { ascending: false });

      if (rulesError) {
        console.error('Error fetching rules:', rulesError);
        throw new Error('Failed to fetch pricing rules');
      }

      return {
        ...template,
        pricingRules: rules || []
      };
    } catch (error) {
      console.error('Error in getTemplateWithRules:', error);
      throw error;
    }
  }

  /**
   * Get client configurations
   */
  static async getClientConfigurations(supabase: any, clientId?: string): Promise<ClientConfiguration[]> {
    try {
      let query = supabase
        .from('client_configurations')
        .select(`
          *,
          calculator_templates (
            id,
            name,
            description
          )
        `)
        .eq('is_active', true);

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query.order('client_name');

      if (error) {
        console.error('Error fetching client configurations:', error);
        throw new Error('Failed to fetch client configurations');
      }

      return data || [];
    } catch (error) {
      console.error('Error in getClientConfigurations:', error);
      throw error;
    }
  }

  /**
   * Create new client configuration
   */
  static async createClientConfig(supabase: any, input: CreateClientConfigInput): Promise<ClientConfiguration> {
    try {
      const { data, error } = await supabase
        .from('client_configurations')
        .insert({
          client_id: input.clientId,
          template_id: input.templateId,
          client_name: input.clientName,
          rule_overrides: input.ruleOverrides,
          area_rules: input.areaRules,
          is_active: input.isActive
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating client configuration:', error);
        throw new Error('Failed to create client configuration');
      }

      return data;
    } catch (error) {
      console.error('Error in createClientConfig:', error);
      throw error;
    }
  }

  /**
   * Get pricing rules for a template
   */
  static async getRulesForTemplate(supabase: any, templateId: string): Promise<PricingRule[]> {
    try {
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('*')
        .eq('template_id', templateId)
        .order('priority', { ascending: false });

      if (error) {
        console.error('Error fetching pricing rules:', error);
        throw new Error('Failed to fetch pricing rules');
      }

      return data || [];
    } catch (error) {
      console.error('Error in getRulesForTemplate:', error);
      throw error;
    }
  }

  /**
   * Perform calculation using template and optional client configuration
   */
  static async calculate(
    supabase: any,
    templateId: string,
    input: CalculationInput,
    clientConfigId?: string,
    userId?: string
  ): Promise<CalculationResult> {
    try {
      // Get template and rules
      const template = await this.getTemplateWithRules(supabase, templateId);
      if (!template) {
        throw new Error('Calculator template not found');
      }

      // Get client configuration if specified
      let clientConfig: ClientConfiguration | null = null;
      if (clientConfigId) {
        const { data, error } = await supabase
          .from('client_configurations')
          .select('*')
          .eq('id', clientConfigId)
          .single();

        if (error) {
          console.error('Error fetching client configuration:', error);
        } else {
          clientConfig = data;
        }
      }

      // Perform the calculation
      const result = this.performCalculation(template, input, clientConfig);

      return result;
    } catch (error) {
      console.error('Error in calculate:', error);
      throw error;
    }
  }

  /**
   * Core calculation logic
   */
  private static performCalculation(
    template: CalculatorTemplate,
    input: CalculationInput,
    clientConfig?: ClientConfiguration | null
  ): CalculationResult {
    const customerCharges: CustomerCharges = {
      baseFee: 0,
      longDistanceCharge: 0,
      bridgeToll: 0,
      extraStopsCharge: 0,
      headcountCharge: 0,
      foodCost: input.foodCost || 0, // Track food cost separately but don't add to total
      customCharges: {},
      subtotal: 0,
      total: 0
    };

    const driverPayments: DriverPayments = {
      basePay: 0,
      mileagePay: 0,
      bridgeToll: 0,
      extraStopsBonus: 0,
      tips: input.tips || 0,
      adjustments: input.adjustments || 0,
      customPayments: {},
      subtotal: 0,
      total: 0
    };

    // Get rules from template
    const rules = template.pricingRules || [];

    // Apply customer charge rules (handle both database format and TypeScript format)
    const customerRules = rules.filter(rule => (rule.ruleType || rule.rule_type) === 'customer_charge');
    const driverRules = rules.filter(rule => (rule.ruleType || rule.rule_type) === 'driver_payment');

    // Process customer charges
    customerRules.forEach(rule => {
      const amount = this.evaluateRule(rule, input, clientConfig);
      
      const ruleName = rule.ruleName || rule.rule_name;
      switch (ruleName) {
        case 'base_fee':
        case 'tiered_base_fee':
          customerCharges.baseFee = amount;
          break;
        case 'long_distance':
          customerCharges.longDistanceCharge = amount;
          break;
        case 'bridge_toll':
          customerCharges.bridgeToll = amount;
          break;
        case 'extra_stops':
          customerCharges.extraStopsCharge = amount;
          break;
        default:
          customerCharges.customCharges[ruleName] = amount;
      }
    });

    // Process driver payments
    // Key Rule: If tips are provided, driver gets tips but NO bonus structure (tiered base pay)
    const hasTips = (input.tips || 0) > 0;
    
    driverRules.forEach(rule => {
      const ruleName = rule.ruleName || rule.rule_name;
      
      // Skip tiered base pay if tips are provided (Ready Set Food rule)
      if (hasTips && (ruleName === 'tiered_base_pay' || ruleName === 'base_pay')) {
        return; // Driver gets tips instead of base pay
      }
      
      const amount = this.evaluateRule(rule, input, clientConfig);
      
      switch (ruleName) {
        case 'tiered_base_pay':
        case 'base_pay':
          driverPayments.basePay = amount;
          break;
        case 'mileage':
          driverPayments.mileagePay = amount;
          break;
        case 'bridge_toll':
          driverPayments.bridgeToll = amount;
          break;
        case 'extra_stops':
          driverPayments.extraStopsBonus = amount;
          break;
        case 'tips':
          // Tips are handled separately, this rule just validates the rule exists
          break;
        default:
          driverPayments.customPayments[ruleName] = amount;
      }
    });

    // Calculate totals
    customerCharges.subtotal = customerCharges.baseFee + 
                              customerCharges.longDistanceCharge + 
                              customerCharges.bridgeToll + 
                              customerCharges.extraStopsCharge + 
                              customerCharges.headcountCharge +
                              Object.values(customerCharges.customCharges).reduce((sum, val) => sum + val, 0);
    
    // Add tips to customer total (customer pays the tip)
    customerCharges.total = customerCharges.subtotal + (input.tips || 0);

    driverPayments.subtotal = driverPayments.basePay + 
                             driverPayments.mileagePay + 
                             driverPayments.bridgeToll + 
                             driverPayments.extraStopsBonus +
                             Object.values(driverPayments.customPayments).reduce((sum, val) => sum + val, 0);
    
    driverPayments.total = driverPayments.subtotal + driverPayments.tips + driverPayments.adjustments;

    const profit = customerCharges.total - driverPayments.total;
    const profitMargin = customerCharges.total > 0 ? (profit / customerCharges.total) * 100 : 0;

    return {
      customerCharges,
      driverPayments,
      profit,
      profitMargin,
      calculatedAt: new Date(),
      templateUsed: template.name,
      configUsed: clientConfig?.clientName
    };
  }

  /**
   * Evaluate a single pricing rule
   */
  private static evaluateRule(
    rule: PricingRule,
    input: CalculationInput,
    clientConfig?: ClientConfiguration | null
  ): number {
    // Check for client config overrides
    if (clientConfig?.ruleOverrides?.[rule.id]) {
      const override = clientConfig.ruleOverrides[rule.id];
      if (typeof override === 'number') {
        return override;
      }
    }

    let amount = 0;

    // Handle database field names and convert strings to numbers
    const baseAmount = parseFloat(rule.baseAmount || rule.base_amount) || 0;
    const perUnitAmount = parseFloat(rule.perUnitAmount || rule.per_unit_amount) || 0;
    const thresholdValue = parseFloat(rule.thresholdValue || rule.threshold_value) || 0;
    const thresholdType = rule.thresholdType || rule.threshold_type;
    const ruleName = rule.ruleName || rule.rule_name;

    // Special handling for tiered pricing rules
    if (ruleName === 'tiered_base_fee' || ruleName === 'tiered_base_pay') {
      return this.calculateTieredAmount(ruleName, input);
    }

    // Base amount
    if (baseAmount > 0) {
      amount += baseAmount;
    }

    // Per-unit calculations
    if (perUnitAmount > 0) {
      let units = 0;
      
      switch (ruleName) {
        case 'mileage':
        case 'long_distance':
          units = input.mileage || 0;
          // For long distance, only charge above threshold
          if (thresholdValue > 0 && thresholdType === 'above') {
            units = Math.max(0, units - thresholdValue);
          }
          break;
        case 'extra_stops':
          units = Math.max(0, (input.numberOfStops || 1) - 1); // First stop is included
          break;
        default:
          units = 1; // Default multiplier
      }
      
      amount += perUnitAmount * units;
    }

    // Special handling for bridge toll - only apply if bridge is required
    if (ruleName === 'bridge_toll' && !input.requiresBridge) {
      amount = 0; // No bridge toll if bridge not required
    }

    // Apply threshold conditions
    if (thresholdValue > 0 && thresholdType) {
      const applicableValue = this.getApplicableValue(ruleName, input);
      
      switch (thresholdType) {
        case 'above':
          if (applicableValue <= thresholdValue) {
            amount = 0; // Rule doesn't apply
          }
          break;
        case 'below':
          if (applicableValue >= thresholdValue) {
            amount = 0; // Rule doesn't apply
          }
          break;
        case 'between':
          // Would need additional logic for between thresholds
          break;
      }
    }

    return Math.max(0, amount); // Ensure non-negative
  }

  /**
   * Calculate tiered pricing based on headcount and order value
   * Uses the LOWER tier when headcount and order value suggest different tiers
   */
  private static calculateTieredAmount(ruleName: string, input: CalculationInput): number {
    const headcount = input.headcount || 0;
    const orderValue = input.foodCost || 0;
    
    // Determine tier by headcount
    let headcountTier = 1;
    if (headcount >= 100) headcountTier = 5;
    else if (headcount >= 75) headcountTier = 4;
    else if (headcount >= 50) headcountTier = 3;
    else if (headcount >= 25) headcountTier = 2;
    else headcountTier = 1;
    
    // Determine tier by order value
    let orderTier = 1;
    if (orderValue >= 1200) orderTier = 5;
    else if (orderValue >= 900) orderTier = 4;
    else if (orderValue >= 600) orderTier = 3;
    else if (orderValue >= 300) orderTier = 2;
    else orderTier = 1;
    
    // Use the LOWER tier (more conservative pricing)
    const finalTier = Math.min(headcountTier, orderTier);
    
    // Ready Set Food pricing tiers
    const customerBaseFees = [65, 75, 85, 95, 105]; // Tier 1-5
    const driverBasePay = [35, 40, 50, 60, 70]; // Tier 1-5
    
    if (ruleName === 'tiered_base_fee') {
      return customerBaseFees[finalTier - 1] || 65; // Default to Tier 1
    } else if (ruleName === 'tiered_base_pay') {
      return driverBasePay[finalTier - 1] || 35; // Default to Tier 1
    }
    
    return 0;
  }

  /**
   * Get the value to compare against thresholds
   */
  private static getApplicableValue(ruleName: string, input: CalculationInput): number {
    switch (ruleName) {
      case 'mileage':
      case 'long_distance':
        return input.mileage || 0;
      case 'headcount_adjustment':
        return input.headcount || 0;
      case 'food_cost':
        return input.foodCost || 0;
      default:
        return 0;
    }
  }

  /**
   * Save calculation to history
   */
  static async saveCalculationHistory(
    supabase: any,
    templateId: string,
    input: CalculationInput,
    result: CalculationResult,
    clientConfigId?: string,
    userId?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('calculation_history')
        .insert({
          template_id: templateId,
          client_config_id: clientConfigId,
          user_id: userId,
          input_data: input,
          customer_charges: result.customerCharges,
          driver_payments: result.driverPayments,
          customer_total: result.customerCharges.total,
          driver_total: result.driverPayments.total
        });

      if (error) {
        console.error('Error saving calculation history:', error);
        // Don't throw here - saving history is not critical
      }
    } catch (error) {
      console.error('Error in saveCalculationHistory:', error);
      // Don't throw here - saving history is not critical
    }
  }
}