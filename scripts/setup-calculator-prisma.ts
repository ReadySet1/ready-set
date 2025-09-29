#!/usr/bin/env tsx

// Setup Calculator Templates Script - Using Prisma
// Populates the calculator system with default templates and rules

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env.development.local' });
config({ path: '.env' });

const prisma = new PrismaClient();

async function setupCalculatorTemplates() {
  console.log('🚀 Setting up calculator templates with Prisma...');

  try {
    // 1. Create Ready Set Food Standard Delivery template
    console.log('📝 Creating Ready Set Food template...');
    
    // First try to find existing template
    let template = await prisma.calculatorTemplate.findFirst({
      where: {
        name: 'Ready Set Food Standard Delivery'
      }
    });

    if (!template) {
      // Create new template if not exists
      template = await prisma.calculatorTemplate.create({
        data: {
          name: 'Ready Set Food Standard Delivery',
          description: 'Standard compensation structure for Ready Set Food deliveries with tiered base fees and driver payments',
          isActive: true
        }
      });
    } else {
      // Update existing template
      template = await prisma.calculatorTemplate.update({
        where: {
          id: template.id
        },
        data: {
          description: 'Standard compensation structure for Ready Set Food deliveries with tiered base fees and driver payments',
          isActive: true
        }
      });
    }

    console.log('✅ Template created:', template.name, 'ID:', template.id);

    // 2. Clear existing rules for this template
    console.log('🧹 Clearing existing rules...');
    await prisma.pricingRule.deleteMany({
      where: {
        templateId: template.id
      }
    });

    // 3. Create pricing rules
    console.log('📏 Creating pricing rules...');
    
    const rules = [
      // Customer charge rules
      {
        templateId: template.id,
        ruleType: 'customer_charge',
        ruleName: 'tiered_base_fee',
        baseAmount: null,
        perUnitAmount: null,
        thresholdValue: null,
        thresholdType: null,
        priority: 100
      },
      {
        templateId: template.id,
        ruleType: 'customer_charge',
        ruleName: 'long_distance',
        baseAmount: 0,
        perUnitAmount: 3.00,
        thresholdValue: 10,
        thresholdType: 'above',
        priority: 90
      },
      {
        templateId: template.id,
        ruleType: 'customer_charge',
        ruleName: 'bridge_toll',
        baseAmount: 8.00,
        perUnitAmount: null,
        thresholdValue: null,
        thresholdType: null,
        priority: 80
      },
      // Driver payment rules
      {
        templateId: template.id,
        ruleType: 'driver_payment',
        ruleName: 'tiered_base_pay',
        baseAmount: null,
        perUnitAmount: null,
        thresholdValue: null,
        thresholdType: null,
        priority: 100
      },
      {
        templateId: template.id,
        ruleType: 'driver_payment',
        ruleName: 'mileage',
        baseAmount: 0,
        perUnitAmount: 0.35,
        thresholdValue: 10,
        thresholdType: 'above',
        priority: 90
      },
      {
        templateId: template.id,
        ruleType: 'driver_payment',
        ruleName: 'bridge_toll',
        baseAmount: 8.00,
        perUnitAmount: null,
        thresholdValue: null,
        thresholdType: null,
        priority: 80
      },
      {
        templateId: template.id,
        ruleType: 'driver_payment',
        ruleName: 'tips',
        baseAmount: null,
        perUnitAmount: null,
        thresholdValue: null,
        thresholdType: null,
        priority: 70
      }
    ];

    // Create rules one by one to handle potential conflicts
    let createdRules = 0;
    for (const rule of rules) {
      try {
        await prisma.pricingRule.create({
          data: rule
        });
        createdRules++;
      } catch (error) {
        console.warn('⚠️ Rule creation skipped (may already exist):', rule.ruleName);
      }
    }

    console.log('✅ Created', createdRules, 'pricing rules');

    // 4. Verify the setup
    console.log('🔍 Verifying setup...');
    
    const verifyTemplate = await prisma.calculatorTemplate.findUnique({
      where: {
        id: template.id
      },
      include: {
        pricingRules: true
      }
    });

    if (!verifyTemplate) {
      throw new Error('Template verification failed');
    }

    console.log('✅ Template verification complete:');
    console.log('   Template:', verifyTemplate.name);
    console.log('   Rules:', verifyTemplate.pricingRules.length);
    console.log('   Customer rules:', verifyTemplate.pricingRules.filter(r => r.ruleType === 'customer_charge').length);
    console.log('   Driver rules:', verifyTemplate.pricingRules.filter(r => r.ruleType === 'driver_payment').length);

    // 5. Check all templates
    const allTemplates = await prisma.calculatorTemplate.findMany({
      include: {
        pricingRules: true
      }
    });

    console.log('📊 Total templates in database:', allTemplates.length);
    allTemplates.forEach(t => {
      console.log(`   - ${t.name} (${t.pricingRules.length} rules)`);
    });

    console.log('🎉 Calculator templates setup complete!');
    return template;

  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupCalculatorTemplates()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
