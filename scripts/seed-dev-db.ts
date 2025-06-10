#!/usr/bin/env tsx

/**
 * Development Database Seeding Script
 * 
 * This script populates the development database with realistic test data
 * Run with: pnpm tsx scripts/seed-dev-db.ts
 */

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://dev_user:dev_password@localhost:5432/ready_set_dev'
    }
  }
});

interface SeedData {
  profiles: number;
  addresses: number;
  cateringRequests: number;
  onDemandRequests: number;
}

const SEED_CONFIG: SeedData = {
  profiles: 50,
  addresses: 100,
  cateringRequests: 75,
  onDemandRequests: 25,
};

/**
 * Generate a random profile based on user type
 */
function generateProfile(type: 'VENDOR' | 'CLIENT' | 'DRIVER' | 'ADMIN') {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const email = faker.internet.email({ firstName, lastName });
  
  const baseProfile = {
    name: `${firstName} ${lastName}`,
    email: email.toLowerCase(),
    image: faker.image.avatar(),
    type,
    contactName: `${firstName} ${lastName}`,
    contactNumber: faker.phone.number(),
    street1: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zip: faker.location.zipCode(),
    status: faker.helpers.arrayElement(['ACTIVE', 'PENDING']) as 'ACTIVE' | 'PENDING',
    createdAt: faker.date.between({ from: '2023-01-01', to: new Date() }),
  };

  // Type-specific fields
  switch (type) {
    case 'VENDOR':
      return {
        ...baseProfile,
        companyName: faker.company.name(),
        website: faker.internet.url(),
        counties: [faker.location.county()],
        timeNeeded: faker.helpers.arrayElement(['2-4 hours', '4-6 hours', '6+ hours']),
        cateringBrokerage: faker.helpers.arrayElement(['ezCater', 'CaterCow', 'Direct']),
        frequency: faker.helpers.arrayElement(['Daily', 'Weekly', 'Monthly']),
        provide: faker.lorem.paragraph(),
      };
    case 'CLIENT':
      return {
        ...baseProfile,
        companyName: faker.company.name(),
        headCount: faker.number.int({ min: 10, max: 500 }),
        frequency: faker.helpers.arrayElement(['Weekly', 'Monthly', 'Quarterly']),
      };
    case 'DRIVER':
      return {
        ...baseProfile,
        locationNumber: faker.phone.number(),
        parkingLoading: faker.lorem.sentence(),
      };
    default:
      return baseProfile;
  }
}

/**
 * Generate a realistic address
 */
function generateAddress(createdBy?: string) {
  return {
    county: faker.location.county(),
    street1: faker.location.streetAddress(),
    street2: faker.helpers.maybe(() => faker.location.secondaryAddress()),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zip: faker.location.zipCode(),
    createdBy,
    isRestaurant: faker.datatype.boolean(0.3), // 30% chance
    isShared: faker.datatype.boolean(0.2), // 20% chance
    locationNumber: faker.helpers.maybe(() => faker.phone.number()),
    name: faker.helpers.maybe(() => faker.company.name()),
    latitude: parseFloat(faker.location.latitude()),
    longitude: parseFloat(faker.location.longitude()),
  };
}

/**
 * Generate a catering request
 */
function generateCateringRequest(userId: string, pickupAddressId: string, deliveryAddressId: string) {
  const pickupDate = faker.date.future();
  const arrivalDate = new Date(pickupDate.getTime() + (1000 * 60 * 60 * 2)); // 2 hours later
  
  return {
    userId,
    pickupAddressId,
    deliveryAddressId,
    orderNumber: `CR-${faker.number.int({ min: 100000, max: 999999 })}`,
    pickupDateTime: pickupDate,
    arrivalDateTime: arrivalDate,
    completeDateTime: faker.helpers.maybe(() => 
      new Date(arrivalDate.getTime() + (1000 * 60 * 60 * 1)) // 1 hour after arrival
    ),
    headcount: faker.number.int({ min: 10, max: 200 }),
    needHost: faker.helpers.arrayElement(['YES', 'NO']) as 'YES' | 'NO',
    hoursNeeded: faker.number.float({ min: 1, max: 8, fractionDigits: 1 }),
    numberOfHosts: faker.number.int({ min: 1, max: 5 }),
    clientAttention: faker.person.fullName(),
    pickupNotes: faker.helpers.maybe(() => faker.lorem.sentence()),
    specialNotes: faker.helpers.maybe(() => faker.lorem.paragraph()),
    brokerage: faker.helpers.arrayElement(['ezCater', 'CaterCow', 'Direct']),
    status: faker.helpers.arrayElement(['ACTIVE', 'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED']) as any,
    orderTotal: faker.number.float({ min: 100, max: 2000, fractionDigits: 2 }),
    tip: faker.number.float({ min: 10, max: 200, fractionDigits: 2 }),
  };
}

/**
 * Generate an on-demand request
 */
function generateOnDemandRequest(userId: string, pickupAddressId: string, deliveryAddressId: string) {
  const pickupDate = faker.date.future();
  const arrivalDate = new Date(pickupDate.getTime() + (1000 * 60 * 60 * 1)); // 1 hour later
  
  return {
    userId,
    pickupAddressId,
    deliveryAddressId,
    orderNumber: `OD-${faker.number.int({ min: 100000, max: 999999 })}`,
    pickupDateTime: pickupDate,
    arrivalDateTime: arrivalDate,
    completeDateTime: faker.helpers.maybe(() => 
      new Date(arrivalDate.getTime() + (1000 * 60 * 30)) // 30 minutes after arrival
    ),
    hoursNeeded: faker.number.float({ min: 0.5, max: 4, fractionDigits: 1 }),
    itemDelivered: faker.commerce.productName(),
    vehicleType: faker.helpers.arrayElement(['CAR', 'VAN', 'TRUCK']) as 'CAR' | 'VAN' | 'TRUCK',
    clientAttention: faker.person.fullName(),
    pickupNotes: faker.helpers.maybe(() => faker.lorem.sentence()),
    specialNotes: faker.helpers.maybe(() => faker.lorem.paragraph()),
    status: faker.helpers.arrayElement(['ACTIVE', 'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED']) as any,
    orderTotal: faker.number.float({ min: 25, max: 500, fractionDigits: 2 }),
    tip: faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
    length: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
    width: faker.number.float({ min: 1, max: 8, fractionDigits: 1 }),
    height: faker.number.float({ min: 1, max: 6, fractionDigits: 1 }),
    weight: faker.number.float({ min: 1, max: 100, fractionDigits: 1 }),
  };
}

/**
 * Main seeding function
 */
async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await prisma.dispatch.deleteMany();
    await prisma.fileUpload.deleteMany();
    await prisma.cateringRequest.deleteMany();
    await prisma.onDemand.deleteMany();
    await prisma.userAddress.deleteMany();
    await prisma.address.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.jobApplication.deleteMany();
    await prisma.formSubmission.deleteMany();
    await prisma.leadCapture.deleteMany();
    await prisma.profile.deleteMany();

    // Create profiles
    console.log(`👥 Creating ${SEED_CONFIG.profiles} profiles...`);
    const profiles = [];
    
    // Create admin user
    const adminProfile = await prisma.profile.create({
      data: {
        ...generateProfile('ADMIN'),
        email: 'admin@readyset.local',
        name: 'Admin User',
        type: 'ADMIN',
        status: 'ACTIVE',
      }
    });
    profiles.push(adminProfile);

    // Create various user types
    const userTypes: ('VENDOR' | 'CLIENT' | 'DRIVER')[] = ['VENDOR', 'CLIENT', 'DRIVER'];
    for (let i = 0; i < SEED_CONFIG.profiles - 1; i++) {
      const type = userTypes[i % userTypes.length];
      const profile = await prisma.profile.create({
        data: generateProfile(type)
      });
      profiles.push(profile);
    }

    // Create addresses
    console.log(`🏠 Creating ${SEED_CONFIG.addresses} addresses...`);
    const addresses = [];
    for (let i = 0; i < SEED_CONFIG.addresses; i++) {
      const createdBy = faker.helpers.arrayElement(profiles).id;
      const address = await prisma.address.create({
        data: generateAddress(createdBy)
      });
      addresses.push(address);
    }

    // Create catering requests
    console.log(`🍽️ Creating ${SEED_CONFIG.cateringRequests} catering requests...`);
    for (let i = 0; i < SEED_CONFIG.cateringRequests; i++) {
      const user = faker.helpers.arrayElement(profiles);
      const pickupAddress = faker.helpers.arrayElement(addresses);
      const deliveryAddress = faker.helpers.arrayElement(addresses);
      
      await prisma.cateringRequest.create({
        data: generateCateringRequest(user.id, pickupAddress.id, deliveryAddress.id)
      });
    }

    // Create on-demand requests
    console.log(`🚚 Creating ${SEED_CONFIG.onDemandRequests} on-demand requests...`);
    for (let i = 0; i < SEED_CONFIG.onDemandRequests; i++) {
      const user = faker.helpers.arrayElement(profiles);
      const pickupAddress = faker.helpers.arrayElement(addresses);
      const deliveryAddress = faker.helpers.arrayElement(addresses);
      
      await prisma.onDemand.create({
        data: generateOnDemandRequest(user.id, pickupAddress.id, deliveryAddress.id)
      });
    }

    // Create some user addresses relationships
    console.log('🔗 Creating user-address relationships...');
    for (const profile of profiles.slice(0, 20)) { // Just for first 20 users
      const userAddresses = faker.helpers.arrayElements(addresses, { min: 1, max: 3 });
      for (let i = 0; i < userAddresses.length; i++) {
        await prisma.userAddress.create({
          data: {
            userId: profile.id,
            addressId: userAddresses[i].id,
            alias: faker.helpers.arrayElement(['Home', 'Work', 'Office', 'Warehouse']),
            isDefault: i === 0, // First address is default
          }
        });
      }
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('\n📊 Seeded data summary:');
    console.log(`  • ${profiles.length} profiles (including 1 admin)`);
    console.log(`  • ${addresses.length} addresses`);
    console.log(`  • ${SEED_CONFIG.cateringRequests} catering requests`);
    console.log(`  • ${SEED_CONFIG.onDemandRequests} on-demand requests`);
    console.log('\n🔑 Test credentials:');
    console.log('  • Admin: admin@readyset.local');
    console.log('  • Database: postgresql://dev_user:dev_password@localhost:5432/ready_set_dev');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedDatabase }; 