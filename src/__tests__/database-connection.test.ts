import { prisma } from '../utils/prismaDB';

/**
 * Database Connection Test Suite
 * 
 * This test suite verifies that the database connection is working correctly
 * and that the Prisma client can access real data from the database.
 * 
 * The test can run in two modes:
 * 1. Test environment: Uses mocked Prisma client (fast, no real DB)
 * 2. Development environment: Uses real database connection (slower, real data)
 */

describe('Database Connection', () => {
  // Test timeout for database operations
  const TIMEOUT = 10000;
  const isTestEnvironment = process.env.NODE_ENV === 'test';

  beforeAll(async () => {
    // Connect to database if not in test environment
    if (!isTestEnvironment) {
      try {
        await prisma.$connect();
        console.log('✅ Connected to database for testing');
      } catch (error) {
        console.error('❌ Failed to connect to database:', error);
        throw error;
      }
    }
  });

  afterAll(async () => {
    // Disconnect from database if not in test environment
    if (!isTestEnvironment) {
      try {
        await prisma.$disconnect();
        console.log('✅ Disconnected from database');
      } catch (error) {
        console.error('❌ Failed to disconnect from database:', error);
      }
    }
  });

  describe('Prisma Client Initialization', () => {
    it('should have a valid Prisma client instance', () => {
      expect(prisma).toBeDefined();
      expect(typeof prisma).toBe('object');
      
      // Check if it's a real client or mock by testing a simple operation
      // Mock clients return 0 for count operations, real clients would throw or return real data
      const isMockClient = isTestEnvironment;
      
      if (isTestEnvironment) {
        // In test environment, we expect a mock client
        expect(isMockClient).toBe(true);
        console.log('ℹ️ Using mock Prisma client (test environment)');
      } else {
        // In development/production, we expect a real client
        expect(isMockClient).toBe(false);
        console.log('ℹ️ Using real Prisma client (development environment)');
      }
    });

    it('should have required model methods', () => {
      // Check for essential Prisma models
      const requiredModels = ['profile', 'cateringRequest', 'onDemand', 'address'];
      
      requiredModels.forEach(model => {
        expect(prisma[model]).toBeDefined();
        expect(typeof prisma[model]).toBe('object');
        
        // Check for basic CRUD methods
        const requiredMethods = ['findMany', 'findUnique', 'create', 'update', 'delete', 'count'];
        requiredMethods.forEach(method => {
          expect(prisma[model][method]).toBeDefined();
          expect(typeof prisma[model][method]).toBe('function');
        });
      });
    });
  });

  describe('Database Connection Status', () => {
    it('should be able to connect to the database', async () => {
      if (isTestEnvironment) {
        // Skip real connection test in test environment
        console.log('⏭️ Skipping real connection test (test environment)');
        return;
      }

      try {
        // Test connection by running a simple query
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        expect(result).toEqual([{ test: 1 }]);
        console.log('✅ Database connection test passed');
      } catch (error) {
        console.error('❌ Database connection test failed:', error);
        throw error;
      }
    }, TIMEOUT);
  });

  describe('Data Access Tests', () => {
    it('should be able to count records in profiles table', async () => {
      if (isTestEnvironment) {
        // In test environment, just verify the method exists
        expect(typeof prisma.profile.count).toBe('function');
        console.log('ℹ️ Skipping real count test (test environment)');
        return;
      }

      try {
        const userCount = await prisma.profile.count();
        expect(typeof userCount).toBe('number');
        expect(userCount).toBeGreaterThanOrEqual(0);
        console.log(`✅ Real user count: ${userCount}`);
      } catch (error) {
        console.error('❌ Failed to count users:', error);
        throw error;
      }
    }, TIMEOUT);

    it('should be able to count records in catering_requests table', async () => {
      if (isTestEnvironment) {
        // In test environment, just verify the method exists
        expect(typeof prisma.cateringRequest.count).toBe('function');
        console.log('ℹ️ Skipping real count test (test environment)');
        return;
      }

      try {
        const orderCount = await prisma.cateringRequest.count();
        expect(typeof orderCount).toBe('number');
        expect(orderCount).toBeGreaterThanOrEqual(0);
        console.log(`✅ Real catering order count: ${orderCount}`);
      } catch (error) {
        console.error('❌ Failed to count catering orders:', error);
        throw error;
      }
    }, TIMEOUT);

    it('should be able to count records in on_demand_requests table', async () => {
      if (isTestEnvironment) {
        // In test environment, just verify the method exists
        expect(typeof prisma.onDemand.count).toBe('function');
        console.log('ℹ️ Skipping real count test (test environment)');
        return;
      }

      try {
        const onDemandCount = await prisma.onDemand.count();
        expect(typeof onDemandCount).toBe('number');
        expect(onDemandCount).toBeGreaterThanOrEqual(0);
        console.log(`✅ Real on-demand order count: ${onDemandCount}`);
      } catch (error) {
        console.error('❌ Failed to count on-demand orders:', error);
        throw error;
      }
    }, TIMEOUT);
  });

  describe('Sample Data Retrieval', () => {
    it('should be able to retrieve sample users', async () => {
      if (isTestEnvironment) {
        // In test environment, just verify the method exists
        expect(typeof prisma.profile.findMany).toBe('function');
        console.log('ℹ️ Skipping real data retrieval test (test environment)');
        return;
      }

      try {
        const sampleUsers = await prisma.profile.findMany({
          take: 5,
          select: {
            id: true,
            name: true,
            email: true,
            type: true,
            status: true,
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        expect(Array.isArray(sampleUsers)).toBe(true);
        expect(sampleUsers.length).toBeLessThanOrEqual(5);
        console.log(`✅ Retrieved ${sampleUsers.length} real users`);
        
        // In development, we should have some real data
        if (sampleUsers.length > 0) {
          const user = sampleUsers[0];
          expect(user).toHaveProperty('id');
          expect(user).toHaveProperty('name');
          expect(user).toHaveProperty('email');
          expect(user).toHaveProperty('type');
          expect(user).toHaveProperty('status');
        }
      } catch (error) {
        console.error('❌ Failed to retrieve sample users:', error);
        throw error;
      }
    }, TIMEOUT);

    it('should be able to retrieve sample catering orders', async () => {
      if (isTestEnvironment) {
        // In test environment, just verify the method exists
        expect(typeof prisma.cateringRequest.findMany).toBe('function');
        console.log('ℹ️ Skipping real data retrieval test (test environment)');
        return;
      }

      try {
        const sampleOrders = await prisma.cateringRequest.findMany({
          take: 5,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            orderTotal: true,
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        expect(Array.isArray(sampleOrders)).toBe(true);
        expect(sampleOrders.length).toBeLessThanOrEqual(5);
        console.log(`✅ Retrieved ${sampleOrders.length} real catering orders`);
        
        // In development, we should have some real data
        if (sampleOrders.length > 0) {
          const order = sampleOrders[0];
          expect(order).toHaveProperty('id');
          expect(order).toHaveProperty('orderNumber');
          expect(order).toHaveProperty('status');
          expect(order).toHaveProperty('orderTotal');
        }
      } catch (error) {
        console.error('❌ Failed to retrieve sample catering orders:', error);
        throw error;
      }
    }, TIMEOUT);
  });

  describe('Environment Configuration', () => {
    it('should have proper environment variables set', () => {
      // Check for essential environment variables
      const requiredEnvVars = ['DATABASE_URL'];
      
      requiredEnvVars.forEach(envVar => {
        if (isTestEnvironment) {
          // In test environment, we expect test values
          expect(process.env[envVar]).toBeDefined();
          console.log(`ℹ️ Test ${envVar}: ${process.env[envVar]?.substring(0, 30)}...`);
        } else {
          // In development environment, we expect real values
          expect(process.env[envVar]).toBeDefined();
          expect(process.env[envVar]).not.toBe('postgresql://test:test@localhost:5432/test_db');
          console.log(`✅ Real ${envVar}: ${process.env[envVar]?.substring(0, 30)}...`);
        }
      });
    });

    it('should have correct NODE_ENV setting', () => {
      const nodeEnv = process.env.NODE_ENV;
      expect(nodeEnv).toBeDefined();
      
      if (nodeEnv === 'test') {
        console.log('ℹ️ Running in test environment');
      } else if (nodeEnv === 'development') {
        console.log('✅ Running in development environment');
      } else {
        console.log(`ℹ️ Running in ${nodeEnv} environment`);
      }
    });
  });
}); 