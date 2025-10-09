// Calculator System Types
// Comprehensive type definitions for the flexible delivery calculator system

import { z } from 'zod';

// Branded types for type safety
export type TemplateId = string & { readonly brand: unique symbol };
export type ConfigurationId = string & { readonly brand: unique symbol };
export type CalculationId = string & { readonly brand: unique symbol };

// Rule types
export type RuleType = 'customer_charge' | 'driver_payment';
export type RuleName = 
  | 'base_fee'
  | 'tiered_base_fee'
  | 'mileage'
  | 'long_distance'
  | 'bridge_toll'
  | 'extra_stops'
  | 'tips'
  | 'headcount_adjustment'
  | 'food_cost'
  | 'driver_bonus'
  | 'base_pay'
  | 'tiered_base_pay';

export type ThresholdType = 'above' | 'below' | 'between';

// Pricing rule schema
export const PricingRuleSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  ruleType: z.enum(['customer_charge', 'driver_payment']),
  ruleName: z.string(),
  baseAmount: z.number().optional(),
  perUnitAmount: z.number().optional(),
  thresholdValue: z.number().optional(),
  thresholdType: z.enum(['above', 'below', 'between']).optional(),
  appliesWhen: z.record(z.any()).optional(),
  priority: z.number().default(0),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export type PricingRule = z.infer<typeof PricingRuleSchema>;

// Calculator template schema
export const CalculatorTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  pricingRules: z.array(PricingRuleSchema).optional()
});

export type CalculatorTemplate = z.infer<typeof CalculatorTemplateSchema>;

// Area rules for location-based pricing
export const AreaRuleSchema = z.object({
  areaName: z.string(),
  customerPays: z.number(),
  driverGets: z.number(),
  hasTolls: z.boolean().default(false),
  tollAmount: z.number().optional(),
  notes: z.string().optional()
});

export type AreaRule = z.infer<typeof AreaRuleSchema>;

// Client configuration schema
export const ClientConfigurationSchema = z.object({
  id: z.string(),
  clientId: z.string().optional(),
  templateId: z.string(),
  clientName: z.string(),
  ruleOverrides: z.record(z.any()).default({}),
  areaRules: z.array(AreaRuleSchema).default([]),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export type ClientConfiguration = z.infer<typeof ClientConfigurationSchema>;

// Calculation input schema
export const CalculationInputSchema = z.object({
  // Basic delivery info
  deliveryType: z.string().optional(),
  headcount: z.number().min(0).default(0),
  foodCost: z.number().min(0).default(0),

  // Distance & location
  mileage: z.number().min(0).default(0),
  requiresBridge: z.boolean().default(false),
  deliveryArea: z.string().optional(),

  // Additional services
  numberOfStops: z.number().min(1).default(1),
  numberOfDrives: z.number().min(1).default(1).optional(),
  tips: z.number().min(0).default(0),
  adjustments: z.number().default(0),
  bridgeToll: z.number().optional(),

  // Driver specific
  driverBaseRate: z.number().optional(),
  mileageRate: z.number().default(0.70),

  // Client specific
  clientConfigId: z.string().optional(),

  // Custom fields for flexible pricing
  customFields: z.record(z.any()).optional()
});

export type CalculationInput = z.infer<typeof CalculationInputSchema>;

// Customer charges breakdown
export interface CustomerCharges {
  baseFee?: number;
  baseDeliveryFee?: number;
  longDistanceCharge?: number;
  mileageCharges?: number;
  bridgeToll: number;
  dailyDriveDiscount?: number;
  extraStopsCharge?: number;
  headcountCharge?: number;
  foodCost?: number;
  customCharges?: Record<string, number>;
  subtotal?: number;
  total: number;
  breakdown?: Array<{ label: string; amount: number }>;
}

// Driver payments breakdown
export interface DriverPayments {
  /**
   * Base pay from tier structure
   * ⚠️ IMPORTANT: Set to 0 when tips > 0 (tip exclusivity rule)
   */
  basePay: number;

  /**
   * Mileage compensation ($0.35/mile for miles > 10)
   * Applied regardless of tip presence
   */
  mileagePay: number;

  /**
   * Driver bonus pay (included in total)
   */
  bonus?: number;

  bridgeToll: number;
  extraStopsBonus?: number;

  /**
   * Direct tips (100% pass-through to driver)
   * When present, excludes base pay (mutually exclusive)
   */
  tips?: number;

  adjustments?: number;
  customPayments?: Record<string, number>;
  subtotal?: number;
  total: number;
  breakdown?: Array<{ label: string; amount: number }>;
}

// Complete calculation result
export interface CalculationResult {
  customerCharges: CustomerCharges;
  driverPayments: DriverPayments;
  profit: number;
  profitMargin?: number;
  calculatedAt: Date | string;
  templateUsed: string;
  configUsed?: string;
  metadata?: Record<string, any>;
}

// Calculation history schema
export const CalculationHistorySchema = z.object({
  id: z.string(),
  templateId: z.string().optional(),
  clientConfigId: z.string().optional(),
  userId: z.string().optional(),
  inputData: z.record(z.any()),
  customerCharges: z.record(z.any()),
  driverPayments: z.record(z.any()),
  customerTotal: z.number(),
  driverTotal: z.number(),
  notes: z.string().optional(),
  createdAt: z.date()
});

export type CalculationHistory = z.infer<typeof CalculationHistorySchema>;

// Rule evaluation context
export interface RuleContext {
  input: CalculationInput;
  currentCharges: Partial<CustomerCharges>;
  currentPayments: Partial<DriverPayments>;
  clientConfig?: ClientConfiguration;
  metadata?: Record<string, any>;
}

// Calculator configuration for UI
export interface CalculatorConfig {
  template: CalculatorTemplate;
  rules: PricingRule[];
  clientConfig?: ClientConfiguration;
  areaRules?: AreaRule[];
}

// API response types
export interface CalculatorApiResponse {
  success: boolean;
  data?: CalculationResult;
  error?: string;
  timestamp: Date;
}

export interface TemplatesApiResponse {
  success: boolean;
  data?: CalculatorTemplate[];
  error?: string;
  total?: number;
}

// Form validation schemas for API endpoints
export const CreateTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  isActive: z.boolean().default(true)
});

export const CreateRuleSchema = z.object({
  templateId: z.string(),
  ruleType: z.enum(['customer_charge', 'driver_payment']),
  ruleName: z.string().min(1, 'Rule name is required'),
  baseAmount: z.number().optional(),
  perUnitAmount: z.number().optional(),
  thresholdValue: z.number().optional(),
  thresholdType: z.enum(['above', 'below', 'between']).optional(),
  appliesWhen: z.string().optional(),
  priority: z.number().default(0)
});

export const CreateClientConfigSchema = z.object({
  clientId: z.string().optional(),
  templateId: z.string(),
  clientName: z.string().min(1, 'Client name is required'),
  ruleOverrides: z.record(z.any()).default({}),
  areaRules: z.array(AreaRuleSchema).default([]),
  isActive: z.boolean().default(true)
});

// Export schema types
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export type CreateRuleInput = z.infer<typeof CreateRuleSchema>;
export type CreateClientConfigInput = z.infer<typeof CreateClientConfigSchema>;

// Utility types for rule evaluation
export type RuleEvaluator = (rule: PricingRule, context: RuleContext) => number;
export type RuleEvaluators = Record<RuleName, RuleEvaluator>;

// Constants for common values
export const DEFAULT_MILEAGE_RATE = 0.35; // Ready Set Food rate
export const DEFAULT_BRIDGE_TOLL = 8.00;
export const DEFAULT_BASE_FEE = 65.00; // Ready Set Food Tier 1
export const DEFAULT_DRIVER_BASE_PAY = 35.00; // Ready Set Food Tier 1
export const LONG_DISTANCE_THRESHOLD = 10; // miles
export const LONG_DISTANCE_RATE = 3.00; // per mile

// Ready Set Food Tier Configuration
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

// Error types
export class CalculatorError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CalculatorError';
  }
}

export class RuleEvaluationError extends CalculatorError {
  constructor(ruleName: string, details?: any) {
    super(`Failed to evaluate rule: ${ruleName}`, 'RULE_EVALUATION_ERROR', details);
  }
}

export class ConfigurationError extends CalculatorError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIGURATION_ERROR', details);
  }
}
