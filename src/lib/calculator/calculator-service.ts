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
import {
  calculateDeliveryCost,
  calculateDriverPay,
  type DeliveryCostInput,
  type DriverPayInput
} from './delivery-cost-calculator';

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

      // Map database fields to interface fields
      const mappedRules = (rules || []).map((rule: any) => ({
        id: rule.id,
        templateId: rule.template_id,
        ruleType: rule.rule_type,
        ruleName: rule.rule_name,
        baseAmount: rule.base_amount ? parseFloat(rule.base_amount.toString()) : undefined,
        perUnitAmount: rule.per_unit_amount ? parseFloat(rule.per_unit_amount.toString()) : undefined,
        thresholdValue: rule.threshold_value ? parseFloat(rule.threshold_value.toString()) : undefined,
        thresholdType: rule.threshold_type,
        appliesWhen: rule.applies_when ? JSON.parse(rule.applies_when) : undefined,
        priority: rule.priority
      }));

      return {
        ...template,
        pricingRules: mappedRules
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
        .select('*')
        .eq('is_active', true);

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query.order('client_name');

      if (error) {
        console.error('Error fetching client configurations:', error);
        throw new Error('Failed to fetch client configurations');
      }

      // Map the database fields to camelCase for consistency
      const mappedData = (data || []).map((config: any) => ({
        id: config.id,
        clientId: config.client_id,
        templateId: config.template_id,
        clientName: config.client_name,
        ruleOverrides: config.rule_overrides || {},
        areaRules: config.area_rules || [],
        isActive: config.is_active,
        createdAt: config.created_at,
        updatedAt: config.updated_at
      }));

      return mappedData;
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
   * Perform calculation using updated Coolfire formulas
   * Uses delivery-cost-calculator.ts with correct mileage rates and driver pay logic
   */
  static async calculate(
    supabase: any,
    templateId: string,
    input: CalculationInput,
    clientConfigId?: string,
    userId?: string
  ): Promise<CalculationResult> {
    try {
      // Get template for name/metadata (rules are now in delivery-cost-calculator.ts)
      const template = await this.getTemplateWithRules(supabase, templateId);
      if (!template) {
        throw new Error('Calculator template not found');
      }

      // Prepare input for delivery cost calculator
      const deliveryInput: DeliveryCostInput = {
        headcount: input.headcount || 0,
        foodCost: input.foodCost || 0,
        totalMileage: input.mileage || 0,
        numberOfDrives: input.numberOfDrives || 1,
        numberOfStops: input.numberOfStops || 1,
        requiresBridge: input.requiresBridge || false,
        bridgeToll: input.bridgeToll,
        clientConfigId: clientConfigId || 'ready-set-food-standard'
      };

      // Prepare input for driver pay calculator
      // Use tips field as bonus amount - if tips > 0, bonus is qualified
      const driverInput: DriverPayInput = {
        ...deliveryInput,
        bonusQualified: (input.tips ?? 0) > 0
      };

      // Calculate using updated formulas
      const deliveryCostBreakdown = calculateDeliveryCost(deliveryInput);
      const driverPayBreakdown = calculateDriverPay(driverInput);

      // Build result in CalculationResult format
      const customerCharges: CustomerCharges = {
        baseDeliveryFee: deliveryCostBreakdown.deliveryCost,
        mileageCharges: deliveryCostBreakdown.totalMileagePay,
        bridgeToll: deliveryCostBreakdown.bridgeToll,
        dailyDriveDiscount: -deliveryCostBreakdown.dailyDriveDiscount,
        extraStopsCharge: deliveryCostBreakdown.extraStopsCharge,
        total: deliveryCostBreakdown.deliveryFee,
        breakdown: [
          { label: 'Base Delivery Fee', amount: deliveryCostBreakdown.deliveryCost },
          { label: 'Mileage Charges', amount: deliveryCostBreakdown.totalMileagePay },
          { label: 'Extra Stops Charge', amount: deliveryCostBreakdown.extraStopsCharge },
          { label: 'Bridge Toll', amount: deliveryCostBreakdown.bridgeToll },
          { label: 'Daily Drive Discount', amount: -deliveryCostBreakdown.dailyDriveDiscount }
        ]
      };

      const driverPayments: DriverPayments = {
        basePay: driverPayBreakdown.driverBasePayPerDrop,
        mileagePay: driverPayBreakdown.totalMileagePay,
        bonus: driverPayBreakdown.driverBonusPay,
        bridgeToll: driverPayBreakdown.bridgeToll,
        extraStopsBonus: driverPayBreakdown.extraStopsBonus,
        total: driverPayBreakdown.totalDriverPay,
        breakdown: [
          { label: 'Base Pay', amount: driverPayBreakdown.driverBasePayPerDrop },
          { label: `Mileage (${driverPayBreakdown.totalMileage} mi × $${driverPayBreakdown.mileageRate}/mi)`, amount: driverPayBreakdown.totalMileagePay },
          { label: 'Bonus', amount: driverPayBreakdown.driverBonusPay },
          { label: 'Extra Stops Bonus', amount: driverPayBreakdown.extraStopsBonus },
          { label: 'Bridge Toll', amount: driverPayBreakdown.bridgeToll }
        ]
      };

      const result: CalculationResult = {
        customerCharges,
        driverPayments,
        profit: customerCharges.total - driverPayments.total - driverPayBreakdown.readySetTotalFee,
        templateUsed: template.name,
        calculatedAt: new Date().toISOString(),
        metadata: {
          headcount: input.headcount,
          foodCost: input.foodCost,
          mileage: input.mileage,
          numberOfDrives: input.numberOfDrives || 1,
          numberOfStops: input.numberOfStops || 1,
          bonusQualified: driverPayBreakdown.bonusQualified,
          vendorMileageRate: 3.0,
          readySetMileageRate: 3.0,
          driverMileageRate: driverPayBreakdown.mileageRate,
          driverMileageMinimum: 7.0,
          readySetFee: driverPayBreakdown.readySetFee,
          readySetAddonFee: driverPayBreakdown.readySetAddonFee,
          readySetTotalFee: driverPayBreakdown.readySetTotalFee
        }
      };

      return result;
    } catch (error) {
      console.error('Error in calculate:', error);
      throw error;
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

  /**
   * Get calculation history with pagination
   */
  static async getCalculationHistory(
    supabase: any,
    options: {
      userId?: string;
      templateId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('calculation_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }

      if (options.templateId) {
        query = query.eq('template_id', options.templateId);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching calculation history:', error);
        throw new Error('Failed to fetch calculation history');
      }

      // Map the database fields to camelCase for consistency
      const mappedData = (data || []).map((history: any) => ({
        id: history.id,
        templateId: history.template_id,
        clientConfigId: history.client_config_id,
        userId: history.user_id,
        inputData: history.input_data,
        customerCharges: history.customer_charges,
        driverPayments: history.driver_payments,
        customerTotal: history.customer_total,
        driverTotal: history.driver_total,
        notes: history.notes,
        createdAt: history.created_at
      }));

      return mappedData;
    } catch (error) {
      console.error('Error in getCalculationHistory:', error);
      throw error;
    }
  }

  /**
   * Create a new pricing rule (placeholder implementation)
   */
  static async createRule(input: any): Promise<PricingRule> {
    // This would typically create a rule in the database
    // For now, return a mock rule to prevent errors
    console.warn('createRule called but not implemented - returning mock rule');
    return {
      id: 'mock-' + Date.now(),
      templateId: input.templateId || 'mock-template',
      ruleName: input.ruleName || 'mock_rule',
      ruleType: input.ruleType || 'customer_charge',
      baseAmount: input.baseAmount || 0,
      perUnitAmount: input.perUnitAmount || 0,
      thresholdValue: input.thresholdValue || 0,
      thresholdType: input.thresholdType || undefined,
      priority: input.priority || 1
    };
  }

  /**
   * Update an existing pricing rule (placeholder implementation)
   */
  static async updateRule(id: string, updates: any): Promise<PricingRule> {
    // This would typically update a rule in the database
    // For now, return a mock updated rule to prevent errors
    console.warn('updateRule called but not implemented - returning mock rule');
    return {
      id,
      templateId: updates.templateId || 'mock-template',
      ruleName: updates.ruleName || 'updated_rule',
      ruleType: updates.ruleType || 'customer_charge',
      baseAmount: updates.baseAmount || 0,
      perUnitAmount: updates.perUnitAmount || 0,
      thresholdValue: updates.thresholdValue || 0,
      thresholdType: updates.thresholdType || undefined,
      priority: updates.priority || 1
    };
  }

  /**
   * Delete a pricing rule (placeholder implementation)
   */
  static async deleteRule(id: string): Promise<void> {
    // This would typically delete a rule from the database
    // For now, just log the action to prevent errors
    console.warn('deleteRule called but not implemented - rule ID:', id);
  }

  /**
   * Create a new calculator template (placeholder implementation)
   */
  static async createTemplate(input: any): Promise<CalculatorTemplate> {
    // This would typically create a template in the database
    // For now, return a mock template to prevent errors
    console.warn('createTemplate called but not implemented - returning mock template');
    return {
      id: 'mock-template-' + Date.now(),
      name: input.name || 'Mock Template',
      description: input.description || 'Mock template for development',
      isActive: input.isActive !== undefined ? input.isActive : true,
      pricingRules: []
    };
  }

  /**
   * Update an existing calculator template (placeholder implementation)
   */
  static async updateTemplate(id: string, updates: any): Promise<CalculatorTemplate> {
    // This would typically update a template in the database
    // For now, return a mock updated template to prevent errors
    console.warn('updateTemplate called but not implemented - returning mock template');
    return {
      id,
      name: updates.name || 'Updated Template',
      description: updates.description || 'Updated template for development',
      isActive: updates.isActive !== undefined ? updates.isActive : true,
      pricingRules: []
    };
  }

  /**
   * Get calculator configuration for a template and optional client config
   */
  static async getCalculatorConfig(templateId: string, clientConfigId?: string): Promise<any> {
    // This would typically combine template and client config data
    // For now, return a basic configuration
    console.warn('getCalculatorConfig called but returning basic config');
    return {
      templateId,
      clientConfigId,
      template: null,
      clientConfig: null
    };
  }
}