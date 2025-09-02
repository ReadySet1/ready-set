// Migration script to convert existing calculator data to the new flexible system
// This script creates default templates and rules based on current hardcoded values

import { PrismaClient } from '@prisma/client';
import { CalculatorService } from '../src/lib/calculator/calculator-service';

const prisma = new PrismaClient();

interface LegacyCalculatorRules {
  name: string;
  description: string;
  customerRules: Array<{
    ruleName: string;
    baseAmount?: number;
    perUnitAmount?: number;
    thresholdValue?: number;
    thresholdType?: string;
    priority: number;
  }>;
  driverRules: Array<{
    ruleName: string;
    baseAmount?: number;
    perUnitAmount?: number;
    thresholdValue?: number;
    thresholdType?: string;
    priority: number;
  }>;
}

// Legacy calculator configurations based on existing hardcoded values
const legacyConfigurations: LegacyCalculatorRules[] = [
  {
    name: 'Standard Delivery',
    description: 'Default delivery calculator with standard rates',
    customerRules: [
      {
        ruleName: 'base_fee',
        baseAmount: 60.00,
        priority: 100
      },
      {
        ruleName: 'long_distance',
        perUnitAmount: 3.00,
        thresholdValue: 10.00,
        thresholdType: 'above',
        priority: 90
      },
      {
        ruleName: 'bridge_toll',
        baseAmount: 8.00,
        priority: 80
      },
      {
        ruleName: 'extra_stops',
        perUnitAmount: 5.00,
        priority: 70
      }
    ],
    driverRules: [
      {
        ruleName: 'base_pay',
        baseAmount: 35.00,
        priority: 100
      },
      {
        ruleName: 'mileage',
        perUnitAmount: 0.70,
        priority: 90
      },
      {
        ruleName: 'bridge_toll',
        baseAmount: 8.00,
        priority: 80
      },
      {
        ruleName: 'extra_stops',
        perUnitAmount: 2.50,
        priority: 70
      }
    ]
  },
  {
    name: 'Flower Delivery',
    description: 'Specialized calculator for flower deliveries',
    customerRules: [
      {
        ruleName: 'base_fee',
        baseAmount: 45.00,
        priority: 100
      },
      {
        ruleName: 'long_distance',
        perUnitAmount: 2.50,
        thresholdValue: 8.00,
        thresholdType: 'above',
        priority: 90
      },
      {
        ruleName: 'bridge_toll',
        baseAmount: 8.00,
        priority: 80
      },
      {
        ruleName: 'extra_stops',
        perUnitAmount: 3.00,
        priority: 70
      }
    ],
    driverRules: [
      {
        ruleName: 'base_pay',
        baseAmount: 25.00,
        priority: 100
      },
      {
        ruleName: 'mileage',
        perUnitAmount: 0.65,
        priority: 90
      },
      {
        ruleName: 'bridge_toll',
        baseAmount: 8.00,
        priority: 80
      },
      {
        ruleName: 'extra_stops',
        perUnitAmount: 2.00,
        priority: 70
      }
    ]
  },
  {
    name: 'Drive Calculator',
    description: 'Calculator for drive-based deliveries with varying headcount',
    customerRules: [
      {
        ruleName: 'base_fee',
        baseAmount: 75.00,
        priority: 100
      },
      {
        ruleName: 'headcount_adjustment',
        perUnitAmount: 2.00,
        priority: 95
      },
      {
        ruleName: 'long_distance',
        perUnitAmount: 4.00,
        thresholdValue: 15.00,
        thresholdType: 'above',
        priority: 90
      },
      {
        ruleName: 'bridge_toll',
        baseAmount: 8.00,
        priority: 80
      }
    ],
    driverRules: [
      {
        ruleName: 'base_pay',
        baseAmount: 50.00,
        priority: 100
      },
      {
        ruleName: 'mileage',
        perUnitAmount: 0.70,
        priority: 90
      },
      {
        ruleName: 'bridge_toll',
        baseAmount: 8.00,
        priority: 80
      }
    ]
  },
  {
    name: 'Ready Set Food Standard Delivery',
    description: 'Standard compensation structure for Ready Set Food deliveries with tiered base fees and driver payments',
    customerRules: [
      {
        ruleName: 'tiered_base_fee',
        priority: 100
      },
      {
        ruleName: 'long_distance',
        baseAmount: 0,
        perUnitAmount: 3.00,
        thresholdValue: 10.00,
        thresholdType: 'above',
        priority: 90
      },
      {
        ruleName: 'bridge_toll',
        baseAmount: 8.00,
        priority: 80
      }
    ],
    driverRules: [
      {
        ruleName: 'tiered_base_pay',
        priority: 100
      },
      {
        ruleName: 'mileage',
        baseAmount: 0,
        perUnitAmount: 0.35,
        thresholdValue: 10.00,
        thresholdType: 'above',
        priority: 90
      },
      {
        ruleName: 'bridge_toll',
        baseAmount: 8.00,
        priority: 80
      },
      {
        ruleName: 'tips',
        priority: 70
      }
    ]
  }
];

async function migrateCalculatorData() {
  console.log('🚀 Starting calculator data migration...');

  try {
    // Check if migration has already been run
    const existingTemplates = await prisma.calculatorTemplate.findMany();
    
    if (existingTemplates.length > 0) {
      console.log('⚠️  Calculator templates already exist. Skipping migration.');
      console.log('   Use --force flag to recreate templates (this will delete existing data).');
      return;
    }

    console.log('📝 Creating calculator templates and rules...');

    for (const config of legacyConfigurations) {
      console.log(`   Creating template: ${config.name}`);

      // Create template
      const template = await CalculatorService.createTemplate({
        name: config.name,
        description: config.description,
        isActive: true
      });

      console.log(`   ✓ Created template with ID: ${template.id}`);

      // Create customer charge rules
      for (const rule of config.customerRules) {
        await CalculatorService.createRule({
          templateId: template.id,
          ruleType: 'customer_charge',
          ruleName: rule.ruleName,
          baseAmount: rule.baseAmount,
          perUnitAmount: rule.perUnitAmount,
          thresholdValue: rule.thresholdValue,
          thresholdType: rule.thresholdType as any,
          priority: rule.priority
        });
      }

      // Create driver payment rules
      for (const rule of config.driverRules) {
        await CalculatorService.createRule({
          templateId: template.id,
          ruleType: 'driver_payment',
          ruleName: rule.ruleName,
          baseAmount: rule.baseAmount,
          perUnitAmount: rule.perUnitAmount,
          thresholdValue: rule.thresholdValue,
          thresholdType: rule.thresholdType as any,
          priority: rule.priority
        });
      }

      console.log(`   ✓ Created ${config.customerRules.length} customer rules and ${config.driverRules.length} driver rules`);
    }

    // Create sample client configurations
    console.log('👥 Creating sample client configurations...');

    const standardTemplate = await prisma.calculatorTemplate.findFirst({
      where: { name: 'Standard Delivery' }
    });

    if (standardTemplate) {
      await CalculatorService.createClientConfig({
        templateId: standardTemplate.id,
        clientName: 'Premium Client',
        ruleOverrides: {
          base_fee: 75.00, // Higher base fee for premium clients
          mileageRate: 0.75 // Higher mileage rate
        },
        areaRules: [
          {
            areaName: 'Downtown',
            customerPays: 65.00,
            driverGets: 40.00,
            hasTolls: false
          },
          {
            areaName: 'Airport',
            customerPays: 85.00,
            driverGets: 55.00,
            hasTolls: true,
            tollAmount: 12.00
          }
        ],
        isActive: true
      });

      console.log('   ✓ Created Premium Client configuration');
    }

    // Verify migration
    const finalTemplates = await prisma.calculatorTemplate.findMany({
      include: {
        pricingRules: true
      }
    });

    const totalRules = finalTemplates.reduce((sum, template) => sum + template.pricingRules.length, 0);

    console.log('✅ Migration completed successfully!');
    console.log(`   📊 Created ${finalTemplates.length} templates with ${totalRules} total rules`);
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   1. Test the new calculator system');
    console.log('   2. Update existing calculator references');
    console.log('   3. Train users on the new flexible system');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function forceRecreate() {
  console.log('🔄 Force recreating calculator data...');
  
  // Delete existing data
  await prisma.calculationHistory.deleteMany();
  await prisma.clientConfiguration.deleteMany();
  await prisma.pricingRule.deleteMany();
  await prisma.calculatorTemplate.deleteMany();
  
  console.log('   ✓ Cleared existing data');
  
  // Run migration
  await migrateCalculatorData();
}

async function testCalculation() {
  console.log('🧪 Testing calculator with sample data...');
  
  const template = await prisma.calculatorTemplate.findFirst({
    where: { name: 'Standard Delivery' }
  });

  if (!template) {
    console.log('❌ No template found for testing');
    return;
  }

  try {
    const result = await CalculatorService.calculate(
      template.id,
      {
        headcount: 25,
        foodCost: 500.00,
        mileage: 15.0,
        requiresBridge: true,
        numberOfStops: 2,
        tips: 20.00,
        adjustments: 0,
        mileageRate: 0.70
      },
      undefined,
      false // Don't save to history
    );

    console.log('   ✓ Test calculation successful:');
    console.log(`     Customer Total: $${result.customerCharges.total.toFixed(2)}`);
    console.log(`     Driver Total: $${result.driverPayments.total.toFixed(2)}`);
    console.log(`     Profit: $${result.profit.toFixed(2)} (${result.profitMargin.toFixed(1)}%)`);
  } catch (error) {
    console.log('❌ Test calculation failed:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const forceFlag = args.includes('--force');
  const testFlag = args.includes('--test');

  try {
    if (forceFlag) {
      await forceRecreate();
    } else {
      await migrateCalculatorData();
    }

    if (testFlag) {
      await testCalculation();
    }
  } catch (error) {
    console.error('Migration script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateCalculatorData, forceRecreate, testCalculation };
