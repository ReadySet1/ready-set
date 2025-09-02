// Calculator Service - Data management and business logic for calculator operations
// Handles API calls and business logic for calculator operations

import { 
  CalculatorTemplate, 
  PricingRule, 
  ClientConfiguration, 
  CalculationHistory,
  CalculationInput,
  CalculationResult,
  CreateTemplateInput,
  CreateRuleInput,
  CreateClientConfigInput,
  CalculatorConfig,
  ConfigurationError
} from '@/types/calculator';
import { CalculatorEngine } from './calculator-engine';
import { prisma } from '@/lib/db/prisma-client';

export class CalculatorService {
  
  /**
   * Gets all active calculator templates
   */
  static async getTemplates(): Promise<CalculatorTemplate[]> {
    try {
      const response = await fetch('/api/calculator/templates', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new ConfigurationError(error.error || 'Failed to fetch templates');
      }

      const { data: templates } = await response.json();
      return templates || [];
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError('Failed to fetch calculator templates', { error });
    }
  }

  /**
   * Gets a specific template by ID
   */
  static async getTemplate(id: string): Promise<CalculatorTemplate | null> {
    try {
      console.log('🔍 getTemplate: Querying database for template...', { id });
      
      const template = await prisma.calculatorTemplate.findUnique({
        where: { id },
        include: {
          pricingRules: {
            orderBy: { priority: 'desc' }
          }
        }
      });

      console.log('🔍 Database Query Result:', {
        found: !!template,
        templateName: template?.name,
        rawRulesCount: template?.pricingRules?.length || 0
      });

      return template ? this.mapTemplate(template) : null;
    } catch (error) {
      console.error('❌ Database query failed:', error);
      throw new ConfigurationError('Failed to fetch calculator template', { error, templateId: id });
    }
  }

  /**
   * Creates a new calculator template
   */
  static async createTemplate(input: CreateTemplateInput): Promise<CalculatorTemplate> {
    try {
      const template = await prisma.calculatorTemplate.create({
        data: {
          name: input.name,
          description: input.description,
          isActive: input.isActive
        },
        include: {
          pricingRules: true
        }
      });

      return this.mapTemplate(template);
    } catch (error) {
      throw new ConfigurationError('Failed to create calculator template', { error, input });
    }
  }

  /**
   * Updates an existing template
   */
  static async updateTemplate(id: string, input: Partial<CreateTemplateInput>): Promise<CalculatorTemplate> {
    try {
      const template = await prisma.calculatorTemplate.update({
        where: { id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          updatedAt: new Date()
        },
        include: {
          pricingRules: {
            orderBy: { priority: 'desc' }
          }
        }
      });

      return this.mapTemplate(template);
    } catch (error) {
      throw new ConfigurationError('Failed to update calculator template', { error, templateId: id, input });
    }
  }

  /**
   * Creates a new pricing rule
   */
  static async createRule(input: CreateRuleInput): Promise<PricingRule> {
    try {
      const rule = await prisma.pricingRule.create({
        data: {
          templateId: input.templateId,
          ruleType: input.ruleType,
          ruleName: input.ruleName,
          baseAmount: input.baseAmount,
          perUnitAmount: input.perUnitAmount,
          thresholdValue: input.thresholdValue,
          thresholdType: input.thresholdType,
          appliesWhen: input.appliesWhen,
          priority: input.priority
        }
      });

      return this.mapRule(rule);
    } catch (error) {
      throw new ConfigurationError('Failed to create pricing rule', { error, input });
    }
  }

  /**
   * Updates an existing pricing rule
   */
  static async updateRule(id: string, input: Partial<CreateRuleInput>): Promise<PricingRule> {
    try {
      const rule = await prisma.pricingRule.update({
        where: { id },
        data: {
          ...(input.ruleType && { ruleType: input.ruleType }),
          ...(input.ruleName && { ruleName: input.ruleName }),
          ...(input.baseAmount !== undefined && { baseAmount: input.baseAmount }),
          ...(input.perUnitAmount !== undefined && { perUnitAmount: input.perUnitAmount }),
          ...(input.thresholdValue !== undefined && { thresholdValue: input.thresholdValue }),
          ...(input.thresholdType && { thresholdType: input.thresholdType }),
          ...(input.appliesWhen !== undefined && { appliesWhen: input.appliesWhen }),
          ...(input.priority !== undefined && { priority: input.priority }),
          updatedAt: new Date()
        }
      });

      return this.mapRule(rule);
    } catch (error) {
      throw new ConfigurationError('Failed to update pricing rule', { error, ruleId: id, input });
    }
  }

  /**
   * Deletes a pricing rule
   */
  static async deleteRule(id: string): Promise<void> {
    try {
      await prisma.pricingRule.delete({
        where: { id }
      });
    } catch (error) {
      throw new ConfigurationError('Failed to delete pricing rule', { error, ruleId: id });
    }
  }

  /**
   * Gets client configurations
   */
  static async getClientConfigurations(clientId?: string): Promise<ClientConfiguration[]> {
    try {
      const configs = await prisma.clientConfiguration.findMany({
        where: clientId ? { clientId } : undefined,
        include: {
          template: {
            include: {
              pricingRules: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return configs.map(this.mapClientConfig);
    } catch (error) {
      throw new ConfigurationError('Failed to fetch client configurations', { error, clientId });
    }
  }

  /**
   * Creates a client configuration
   */
  static async createClientConfig(input: CreateClientConfigInput): Promise<ClientConfiguration> {
    try {
      const config = await prisma.clientConfiguration.create({
        data: {
          clientId: input.clientId,
          templateId: input.templateId,
          clientName: input.clientName,
          ruleOverrides: input.ruleOverrides,
          areaRules: input.areaRules,
          isActive: input.isActive
        }
      });

      return this.mapClientConfig(config);
    } catch (error) {
      throw new ConfigurationError('Failed to create client configuration', { error, input });
    }
  }

  /**
   * Performs a calculation using the calculator engine
   */
  static async calculate(
    templateId: string, 
    input: CalculationInput, 
    clientConfigId?: string,
    saveHistory = true
  ): Promise<CalculationResult> {
    try {
      console.log('📋 CalculatorService: Loading template...', { templateId });
      
      // Get template and rules
      const template = await this.getTemplate(templateId);
      
      console.log('📋 Template Load Result:', {
        found: !!template,
        templateName: template?.name,
        rulesCount: template?.pricingRules?.length || 0,
        ruleTypes: template?.pricingRules?.map(r => `${r.ruleType}:${r.ruleName}`) || []
      });
      
      if (!template || !template.pricingRules) {
        console.error('❌ Template not found or has no rules:', { templateId, template: !!template, rules: template?.pricingRules?.length });
        throw new ConfigurationError('Template not found or has no rules', { templateId });
      }

      // Get client configuration if specified
      let clientConfig: ClientConfiguration | undefined;
      if (clientConfigId) {
        const config = await prisma.clientConfiguration.findUnique({
          where: { id: clientConfigId }
        });
        if (config) {
          clientConfig = this.mapClientConfig(config);
        }
      }

      // Create calculator engine and perform calculation
      const engine = new CalculatorEngine(template.pricingRules, clientConfig);
      const result = engine.calculate(input);

      // Save calculation history if requested
      if (saveHistory) {
        await this.saveCalculationHistory({
          templateId,
          clientConfigId,
          userId: input.customFields?.userId as string,
          inputData: input,
          customerCharges: result.customerCharges,
          driverPayments: result.driverPayments,
          customerTotal: result.customerCharges.total,
          driverTotal: result.driverPayments.total,
          notes: input.customFields?.notes as string
        });
      }

      return result;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError('Failed to perform calculation', { error, templateId, input });
    }
  }

  /**
   * Saves calculation history
   */
  static async saveCalculationHistory(data: {
    templateId?: string;
    clientConfigId?: string;
    userId?: string;
    inputData: any;
    customerCharges: any;
    driverPayments: any;
    customerTotal: number;
    driverTotal: number;
    notes?: string;
  }): Promise<CalculationHistory> {
    try {
      const history = await prisma.calculationHistory.create({
        data: {
          templateId: data.templateId,
          clientConfigId: data.clientConfigId,
          userId: data.userId,
          inputData: data.inputData,
          customerCharges: data.customerCharges,
          driverPayments: data.driverPayments,
          customerTotal: data.customerTotal,
          driverTotal: data.driverTotal,
          notes: data.notes
        }
      });

      return this.mapCalculationHistory(history);
    } catch (error) {
      throw new ConfigurationError('Failed to save calculation history', { error, data });
    }
  }

  /**
   * Gets calculation history
   */
  static async getCalculationHistory(
    userId?: string,
    templateId?: string,
    limit = 50
  ): Promise<CalculationHistory[]> {
    try {
      const history = await prisma.calculationHistory.findMany({
        where: {
          ...(userId && { userId }),
          ...(templateId && { templateId })
        },
        include: {
          template: true,
          user: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return history.map(this.mapCalculationHistory);
    } catch (error) {
      throw new ConfigurationError('Failed to fetch calculation history', { error, userId, templateId });
    }
  }

  /**
   * Gets a complete calculator configuration for the UI
   */
  static async getCalculatorConfig(templateId: string, clientConfigId?: string): Promise<CalculatorConfig> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new ConfigurationError('Template not found', { templateId });
      }

      let clientConfig: ClientConfiguration | undefined;
      if (clientConfigId) {
        const config = await prisma.clientConfiguration.findUnique({
          where: { id: clientConfigId }
        });
        if (config) {
          clientConfig = this.mapClientConfig(config);
        }
      }

      return {
        template,
        rules: template.pricingRules || [],
        clientConfig,
        areaRules: clientConfig?.areaRules || []
      };
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError('Failed to get calculator configuration', { error, templateId, clientConfigId });
    }
  }

  // Mapping functions to convert Supabase types to our types

  private static mapTemplate(template: any): CalculatorTemplate {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      isActive: template.is_active,
      createdAt: new Date(template.created_at),
      updatedAt: new Date(template.updated_at),
      pricingRules: template.pricing_rules?.map(this.mapRule) || []
    };
  }

  private static mapRule(rule: any): PricingRule {
    return {
      id: rule.id,
      templateId: rule.template_id,
      ruleType: rule.rule_type,
      ruleName: rule.rule_name,
      baseAmount: rule.base_amount ? parseFloat(rule.base_amount.toString()) : undefined,
      perUnitAmount: rule.per_unit_amount ? parseFloat(rule.per_unit_amount.toString()) : undefined,
      thresholdValue: rule.threshold_value ? parseFloat(rule.threshold_value.toString()) : undefined,
      thresholdType: rule.threshold_type,
      appliesWhen: rule.applies_when ? JSON.parse(rule.applies_when) : undefined,
      priority: rule.priority,
      createdAt: new Date(rule.created_at),
      updatedAt: new Date(rule.updated_at)
    };
  }

  private static mapClientConfig(config: any): ClientConfiguration {
    return {
      id: config.id,
      clientId: config.clientId,
      templateId: config.templateId,
      clientName: config.clientName,
      ruleOverrides: config.ruleOverrides,
      areaRules: config.areaRules,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    };
  }

  private static mapCalculationHistory(history: any): CalculationHistory {
    return {
      id: history.id,
      templateId: history.templateId,
      clientConfigId: history.clientConfigId,
      userId: history.userId,
      inputData: history.inputData,
      customerCharges: history.customerCharges,
      driverPayments: history.driverPayments,
      customerTotal: parseFloat(history.customerTotal.toString()),
      driverTotal: parseFloat(history.driverTotal.toString()),
      notes: history.notes,
      createdAt: history.createdAt
    };
  }
}
