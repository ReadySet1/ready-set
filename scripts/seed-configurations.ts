/**
 * Seed Script: Delivery Configurations
 * Seeds the database with default client delivery configurations
 */

import { PrismaClient } from '@prisma/client';
import {
  READY_SET_FOOD_STANDARD,
  READY_SET_FOOD_PREMIUM,
  KASA,
  GENERIC_TEMPLATE
} from '../src/lib/calculator/client-configurations';

const prisma = new PrismaClient();

async function seedConfigurations() {
  console.log('🌱 Seeding delivery configurations...\n');

  const configs = [
    READY_SET_FOOD_STANDARD,
    READY_SET_FOOD_PREMIUM,
    KASA,
    GENERIC_TEMPLATE
  ];

  for (const config of configs) {
    try {
      const result = await prisma.deliveryConfiguration.upsert({
        where: { configId: config.id },
        update: {
          clientName: config.clientName,
          vendorName: config.vendorName,
          description: config.description,
          isActive: config.isActive,
          pricingTiers: config.pricingTiers as any,
          mileageRate: config.mileageRate,
          distanceThreshold: config.distanceThreshold,
          dailyDriveDiscounts: config.dailyDriveDiscounts as any,
          driverPaySettings: config.driverPaySettings as any,
          bridgeTollSettings: config.bridgeTollSettings as any,
          customSettings: config.customSettings as any,
          notes: config.notes,
          updatedAt: new Date()
        },
        create: {
          configId: config.id,
          clientName: config.clientName,
          vendorName: config.vendorName,
          description: config.description,
          isActive: config.isActive,
          pricingTiers: config.pricingTiers as any,
          mileageRate: config.mileageRate,
          distanceThreshold: config.distanceThreshold,
          dailyDriveDiscounts: config.dailyDriveDiscounts as any,
          driverPaySettings: config.driverPaySettings as any,
          bridgeTollSettings: config.bridgeTollSettings as any,
          customSettings: config.customSettings as any,
          notes: config.notes
        }
      });

      console.log(`✅ Seeded: ${result.clientName} (${result.configId})`);
    } catch (error) {
      console.error(`❌ Failed to seed ${config.clientName}:`, error);
    }
  }

  console.log('\n✨ Seeding complete!');
}

seedConfigurations()
  .catch((error) => {
    console.error('Fatal error during seeding:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
