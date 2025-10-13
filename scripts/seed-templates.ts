/**
 * Seed Script: Calculator Templates
 * Seeds the database with calculator templates
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTemplates() {
  console.log('🌱 Seeding calculator templates...\n');

  try {
    const template = await prisma.calculatorTemplate.upsert({
      where: {
        id: 'e3ceada6-5a1c-4a52-8f3b-41260b22411c'
      },
      update: {
        name: 'Ready Set Food Standard Delivery',
        description: 'Standard compensation structure for Ready Set Food deliveries with tiered base fees and driver payments',
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        id: 'e3ceada6-5a1c-4a52-8f3b-41260b22411c',
        name: 'Ready Set Food Standard Delivery',
        description: 'Standard compensation structure for Ready Set Food deliveries with tiered base fees and driver payments',
        isActive: true
      }
    });

    console.log(`✅ Seeded: ${template.name} (${template.id})`);
  } catch (error) {
    console.error('❌ Failed to seed template:', error);
  }

  console.log('\n✨ Template seeding complete!');
}

seedTemplates()
  .catch((error) => {
    console.error('Fatal error during seeding:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
