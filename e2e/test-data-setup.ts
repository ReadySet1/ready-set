/**
 * Test Data Setup for Dashboard Testing
 *
 * This script sets up test data for comprehensive dashboard testing
 * including both CLIENT and VENDOR roles with sample orders and data.
 *
 * Usage:
 * - Run this script to create test data before running dashboard tests
 * - This ensures consistent test data for role-based testing
 * - Clean up test data after testing if needed
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

// Test user data
const testUsers = [
  {
    email: 'test-client@example.com',
    password: 'TestPassword123!',
    role: 'CLIENT',
    firstName: 'Test',
    lastName: 'Client',
    phone: '+1-555-0101',
  },
  {
    email: 'test-vendor@example.com',
    password: 'TestPassword123!',
    role: 'VENDOR',
    firstName: 'Test',
    lastName: 'Vendor',
    phone: '+1-555-0102',
  },
];

// Test addresses for users
const testAddresses = [
  {
    userEmail: 'test-client@example.com',
    label: 'Test Client Address',
    street: '123 Test Street',
    city: 'Test City',
    state: 'CA',
    zipCode: '12345',
    isDefault: true,
  },
  {
    userEmail: 'test-vendor@example.com',
    label: 'Test Vendor Address',
    street: '456 Vendor Ave',
    city: 'Vendor City',
    state: 'CA',
    zipCode: '67890',
    isDefault: true,
  },
];

// Test orders for users
const testOrders = [
  // Client orders
  {
    userEmail: 'test-client@example.com',
    orderNumber: 'TEST-CLIENT-001',
    orderType: 'catering',
    status: 'ACTIVE',
    orderTotal: 150.00,
    pickupDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    arrivalDateTime: new Date(Date.now() + 25 * 60 * 60 * 1000), // Tomorrow + 1 hour
  },
  {
    userEmail: 'test-client@example.com',
    orderNumber: 'TEST-CLIENT-002',
    orderType: 'catering',
    status: 'COMPLETED',
    orderTotal: 200.00,
    pickupDateTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
    arrivalDateTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 week ago + 1 hour
  },

  // Vendor orders
  {
    userEmail: 'test-vendor@example.com',
    orderNumber: 'TEST-VENDOR-001',
    orderType: 'catering',
    status: 'ACTIVE',
    orderTotal: 175.00,
    pickupDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000), // Day after tomorrow
    arrivalDateTime: new Date(Date.now() + 49 * 60 * 60 * 1000), // Day after tomorrow + 1 hour
  },
  {
    userEmail: 'test-vendor@example.com',
    orderNumber: 'TEST-VENDOR-002',
    orderType: 'catering',
    status: 'COMPLETED',
    orderTotal: 225.00,
    pickupDateTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    arrivalDateTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 5 days ago + 1 hour
  },
];

async function createTestUsers() {
  console.log('Creating test users...');

  for (const userData of testUsers) {
    try {
      // Check if user already exists
      const existingUser = await prisma.profile.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        console.log(`User ${userData.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const hashedPassword = await hash(userData.password, 12);

      // Create user
      const user = await prisma.profile.create({
        data: {
          email: userData.email,
          type: userData.role as any,
          name: `${userData.firstName} ${userData.lastName}`,
          contactNumber: userData.phone,
          status: 'ACTIVE' as any, // Set as active for testing
        },
      });

      console.log(`Created user: ${userData.email} with role: ${userData.role}`);

      // Create address for user
      await createTestAddress(user.id, userData.email);

      // Create orders for user
      await createTestOrders(user.id, userData.email);

    } catch (error) {
      console.error(`Error creating user ${userData.email}:`, error);
    }
  }
}

async function createTestAddress(userId: string, userEmail: string) {
  const addressData = testAddresses.find(addr => addr.userEmail === userEmail);

  if (!addressData) return;

  try {
    // Create address first
    const address = await prisma.address.create({
      data: {
        street1: addressData.street,
        city: addressData.city,
        state: addressData.state,
        zip: addressData.zipCode,
        createdBy: userId,
      },
    });

    // Then create userAddress relation
    await prisma.userAddress.create({
      data: {
        userId,
        addressId: address.id,
        alias: addressData.label,
        isDefault: addressData.isDefault,
      },
    });

    console.log(`Created address for ${userEmail}`);
  } catch (error) {
    console.error(`Error creating address for ${userEmail}:`, error);
  }
}

async function createTestOrders(userId: string, userEmail: string) {
  const userOrders = testOrders.filter(order => order.userEmail === userEmail);

  // Create pickup and delivery addresses first
  const pickupAddress = await prisma.address.create({
    data: {
      street1: '123 Default Pickup St',
      city: 'Pickup City',
      state: 'CA',
      zip: '12345',
    },
  });

  const deliveryAddress = await prisma.address.create({
    data: {
      street1: '456 Default Delivery Ave',
      city: 'Delivery City',
      state: 'CA',
      zip: '67890',
    },
  });

  for (const orderData of userOrders) {
    try {
      if (orderData.orderType === 'catering') {
        await prisma.cateringRequest.create({
          data: {
            userId,
            orderNumber: orderData.orderNumber,
            status: orderData.status as any,
            orderTotal: orderData.orderTotal,
            pickupDateTime: orderData.pickupDateTime,
            arrivalDateTime: orderData.arrivalDateTime,
            pickupAddressId: pickupAddress.id,
            deliveryAddressId: deliveryAddress.id,
            specialNotes: 'Test order',
          },
        });
      } else {
        await prisma.onDemand.create({
          data: {
            userId,
            orderNumber: orderData.orderNumber,
            status: orderData.status as any,
            orderTotal: orderData.orderTotal,
            pickupDateTime: orderData.pickupDateTime,
            arrivalDateTime: orderData.arrivalDateTime,
            pickupAddressId: pickupAddress.id,
            deliveryAddressId: deliveryAddress.id,
            clientAttention: 'Test Client',
          },
        });
      }

      console.log(`Created order ${orderData.orderNumber} for ${userEmail}`);
    } catch (error) {
      console.error(`Error creating order ${orderData.orderNumber} for ${userEmail}:`, error);
    }
  }
}

async function cleanupTestData() {
  console.log('Cleaning up test data...');

  try {
    // Delete test orders first (due to foreign key constraints)
    for (const order of testOrders) {
      if (order.orderType === 'catering') {
        await prisma.cateringRequest.deleteMany({
          where: { orderNumber: order.orderNumber },
        });
      } else {
        await prisma.onDemand.deleteMany({
          where: { orderNumber: order.orderNumber },
        });
      }
    }

    // Delete test addresses used by orders
    await prisma.address.deleteMany({
      where: {
        OR: [
          { street1: '123 Default Pickup St' },
          { street1: '456 Default Delivery Ave' },
        ],
      },
    });

    // Delete test addresses and userAddresses
    for (const address of testAddresses) {
      // First delete userAddresses by alias
      await prisma.userAddress.deleteMany({
        where: { alias: address.label },
      });

      // Then delete the addresses themselves
      await prisma.address.deleteMany({
        where: {
          street1: address.street,
          city: address.city,
          state: address.state,
          zip: address.zipCode,
        },
      });
    }

    // Delete test users
    for (const user of testUsers) {
      await prisma.profile.deleteMany({
        where: { email: user.email },
      });
    }

    console.log('Test data cleaned up successfully');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}

async function main() {
  const action = process.argv[2] || 'setup'; // 'setup' or 'cleanup'

  if (action === 'setup') {
    await createTestUsers();
    console.log('Test data setup completed successfully!');
  } else if (action === 'cleanup') {
    await cleanupTestData();
    console.log('Test data cleanup completed successfully!');
  } else {
    console.log('Usage: npm run test-data-setup setup|cleanup');
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('Error in test data setup:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
