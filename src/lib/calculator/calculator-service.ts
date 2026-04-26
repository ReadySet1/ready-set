// Calculator Service - Business logic for calculator system operations
// Handles CRUD operations for templates, rules, configurations, and calculations

import * as Sentry from '@sentry/nextjs';
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
  getConfiguration,
  type DeliveryCostInput,
  type DriverPayInput,
  type ClientDeliveryConfiguration
} from './delivery-cost-calculator';
import { prisma } from '@/lib/prisma';

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
  static async getTemplateWithRules(supabase: any, templateId: string, maxRetries = 2): Promise<CalculatorTemplate | null> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data: template, error: templateError } = await supabase
          .from('calculator_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (templateError) {
          const isTransient = templateError?.message?.includes('fetch failed') ||
            templateError?.message?.includes('SocketError') ||
            templateError?.message?.includes('ECONNRESET');

          if (isTransient && attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
            continue;
          }

          // Non-transient error: propagate instead of silently returning null
          throw new Error(`Failed to fetch template ${templateId}: ${templateError.message}`);
        }

        if (!template) {
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
      } catch (error: any) {
        lastError = error;
        const isTransient = error?.message?.includes('fetch failed') ||
          error?.message?.includes('SocketError') ||
          error?.message?.includes('ECONNRESET') ||
          error?.cause?.code === 'UND_ERR_SOCKET';

        if (isTransient && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
      }
    }

    console.error('Error in getTemplateWithRules after retries:', lastError);
    throw lastError;
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

      // Fetch client config from DB first (authoritative source for operator edits),
      // fall back to in-memory config
      const configId = clientConfigId || 'ready-set-food-standard';
      let dbConfig: ClientDeliveryConfiguration | undefined;
      try {
        const dbRecord = await prisma.deliveryConfiguration.findFirst({
          where: { configId, isActive: true }
        });
        if (dbRecord) {
          // Selectively merge boolean flags from in-memory defaults into
          // DB driverPaySettings. Only boolean flags are safe to inherit —
          // structural data (tiers, mileage settings) must NOT be merged
          // because their absence in the DB means the flat fallback values
          // (basePayPerDrop, driverMileageRate) should be used instead.
          const inMemoryConfig = getConfiguration(configId);
          const dbDriverPay = dbRecord.driverPaySettings as any;
          const inMemoryDriverPay = inMemoryConfig?.driverPaySettings;
          const mergedDriverPaySettings = {
            ...dbDriverPay,
            // Only inherit boolean flags when missing from DB
            readySetFeeMatchesDeliveryFee:
              dbDriverPay.readySetFeeMatchesDeliveryFee ?? inMemoryDriverPay?.readySetFeeMatchesDeliveryFee,
            requiresManualReview:
              dbDriverPay.requiresManualReview ?? inMemoryDriverPay?.requiresManualReview,
            includeDirectTipInReadySetTotal:
              dbDriverPay.includeDirectTipInReadySetTotal ?? inMemoryDriverPay?.includeDirectTipInReadySetTotal,
          };

          dbConfig = {
            id: dbRecord.configId,
            clientName: dbRecord.clientName,
            vendorName: dbRecord.vendorName,
            description: dbRecord.description || undefined,
            isActive: dbRecord.isActive,
            pricingTiers: dbRecord.pricingTiers as any,
            mileageRate: parseFloat(dbRecord.mileageRate.toString()),
            distanceThreshold: parseFloat(dbRecord.distanceThreshold.toString()),
            dailyDriveDiscounts: dbRecord.dailyDriveDiscounts as any,
            driverPaySettings: mergedDriverPaySettings,
            bridgeTollSettings: dbRecord.bridgeTollSettings as any,
            zeroOrderSettings: dbRecord.zeroOrderSettings as any ?? undefined,
            customSettings: dbRecord.customSettings as any ?? undefined,
            createdAt: dbRecord.createdAt,
            updatedAt: dbRecord.updatedAt,
            createdBy: dbRecord.createdBy || undefined,
            notes: dbRecord.notes || undefined
          };
        }
      } catch (dbError) {
        // Log but don't fail — fall through to in-memory fallback
        console.warn('DB lookup failed for client config in calculate, falling back to in-memory:', dbError);
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
        clientConfigId: configId,
        configOverride: dbConfig
      };

      // Prepare input for driver pay calculator
      // bonusQualified is false here because we handle bonus via input.tips directly
      const driverInput: DriverPayInput = {
        ...deliveryInput,
        bonusQualified: false
      };

      // Calculate using updated formulas
      const deliveryCostBreakdown = calculateDeliveryCost(deliveryInput);
      const driverPayBreakdown = calculateDriverPay(driverInput);

      // User-entered driver bonus pay (from the "Driver Bonus Pay" field)
      const driverBonusPay = input.tips ?? 0;

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

      const adjustments = input.adjustments ?? 0;

      const driverPayments: DriverPayments = {
        basePay: driverPayBreakdown.driverBasePayPerDrop,
        mileagePay: driverPayBreakdown.totalMileagePay,
        bonus: driverBonusPay,
        bridgeToll: driverPayBreakdown.bridgeToll,
        extraStopsBonus: driverPayBreakdown.extraStopsBonus,
        adjustments,
        total: driverPayBreakdown.totalDriverPay + driverBonusPay + adjustments,
        breakdown: [
          { label: 'Base Pay', amount: driverPayBreakdown.driverBasePayPerDrop },
          { label: `Mileage (${driverPayBreakdown.totalMileage} mi × $${driverPayBreakdown.mileageRate}/mi)`, amount: driverPayBreakdown.totalMileagePay },
          { label: 'Bonus', amount: driverBonusPay },
          { label: 'Extra Stops Bonus', amount: driverPayBreakdown.extraStopsBonus },
          { label: 'Bridge Toll', amount: driverPayBreakdown.bridgeToll },
          { label: 'Adjustments', amount: adjustments }
        ]
      };

      // Get client configuration for mileage rate (prefer DB config, fall back to in-memory)
      const clientConfig = dbConfig || getConfiguration(configId);
      const clientMileageRate = clientConfig?.mileageRate ?? 3.0;

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
          vendorMileageRate: clientMileageRate,
          readySetMileageRate: clientMileageRate,
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
      Sentry.captureException(error, {
        tags: { operation: 'save-calculation-history' },
        level: 'warning',
      });
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
   * Create a new pricing rule
   */
  static async createRule(_input: any): Promise<PricingRule> {
    throw new Error('Not implemented: createRule requires database integration');
  }

  /**
   * Update an existing pricing rule
   */
  static async updateRule(_id: string, _updates: any): Promise<PricingRule> {
    throw new Error('Not implemented: updateRule requires database integration');
  }

  /**
   * Delete a pricing rule
   */
  static async deleteRule(_id: string): Promise<void> {
    throw new Error('Not implemented: deleteRule requires database integration');
  }

  /**
   * Create a new calculator template
   */
  static async createTemplate(_input: any): Promise<CalculatorTemplate> {
    throw new Error('Not implemented: createTemplate requires database integration');
  }

  /**
   * Update an existing calculator template
   */
  static async updateTemplate(_id: string, _updates: any): Promise<CalculatorTemplate> {
    throw new Error('Not implemented: updateTemplate requires database integration');
  }

  /**
   * Get calculator configuration for a template and optional client config
   */
  static async getCalculatorConfig(_templateId: string, _clientConfigId?: string): Promise<any> {
    throw new Error('Not implemented: getCalculatorConfig requires database integration');
  }
}