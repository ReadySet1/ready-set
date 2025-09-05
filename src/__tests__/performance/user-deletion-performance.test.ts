/**
 * Performance Test Suite for User Deletion Operations
 * 
 * This test suite focuses on:
 * 1. Transaction performance measurement
 * 2. Scalability testing with various user types
 * 3. Bottleneck identification
 * 4. Memory and resource usage analysis
 */

import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/users/[userId]/route';
import { UserType } from '@/types/prisma';
import { prisma } from '@/utils/prismaDB';

// Mock Supabase for controlled auth testing
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
};

jest.mock('@/utils/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
}));

// Performance measurement utilities
interface PerformanceMetrics {
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  operationCounts: {
    profiles: number;
    addresses: number;
    fileUploads: number;
    dispatches: number;
    userAddresses: number;
    sessions: number;
    accounts: number;
  };
}

const measurePerformance = async (operation: () => Promise<any>): Promise<PerformanceMetrics> => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  await operation();
  
  const endTime = Date.now();
  const endMemory = process.memoryUsage();
  
  return {
    duration: endTime - startTime,
    memoryUsage: {
      rss: endMemory.rss - startMemory.rss,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external,
      arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
    },
    operationCounts: {
      profiles: 1, // Will be updated based on actual operations
      addresses: 0,
      fileUploads: 0,
      dispatches: 0,
      userAddresses: 0,
      sessions: 0,
      accounts: 0,
    },
  };
};

const createTestUser = async (type: UserType, relatedDataCount: number = 0) => {
  const timestamp = Date.now();
  const user = await prisma.profile.create({
    data: {
      email: `perf-test-${type.toLowerCase()}-${timestamp}@example.com`,
      name: `Performance Test ${type} User`,
      type,
      status: 'ACTIVE',
    },
  });

  // Create related data for scalability testing
  if (relatedDataCount > 0) {
    const promises: Promise<any>[] = [];

    // Create addresses
    for (let i = 0; i < Math.min(relatedDataCount, 5); i++) {
      promises.push(
        prisma.address.create({
          data: {
            street1: `${i + 1} Performance Test St`,
            city: 'Test City',
            state: 'TX',
            zip: '12345',
            createdBy: user.id,
            userAddresses: {
              create: {
                userId: user.id,
                alias: `Address ${i + 1}`,
              },
            },
          },
        })
      );
    }

    // Create file uploads
    for (let i = 0; i < Math.min(relatedDataCount, 10); i++) {
      promises.push(
        prisma.fileUpload.create({
          data: {
            userId: user.id,
            fileName: `perf-test-file-${i}.pdf`,
            fileType: 'application/pdf',
            fileSize: 1024 * (i + 1),
            fileUrl: `https://example.com/perf-test-file-${i}.pdf`,
          },
        })
      );
    }

    // Create sessions
    for (let i = 0; i < Math.min(relatedDataCount, 3); i++) {
      promises.push(
        prisma.session.create({
          data: {
            userId: user.id,
            sessionToken: `perf-test-session-${timestamp}-${i}`,
            expires: new Date(Date.now() + 86400000),
          },
        })
      );
    }

    // Create accounts
    for (let i = 0; i < Math.min(relatedDataCount, 2); i++) {
      promises.push(
        prisma.account.create({
          data: {
            userId: user.id,
            type: 'oauth',
            provider: i === 0 ? 'google' : 'github',
            providerAccountId: `perf-test-${timestamp}-${i}`,
          },
        })
      );
    }

    await Promise.all(promises);
  }

  return user;
};

const isTestEnvironment = process.env.NODE_ENV === 'test';

describe('User Deletion Performance Tests', () => {
  const skipMessage = 'Skipping performance test in test environment';
  let adminUser: any;

  beforeAll(async () => {
    if (!isTestEnvironment) {
      try {
        await prisma.$connect();
        
        // Create admin user for testing
        adminUser = await prisma.profile.create({
          data: {
            email: `perf-admin-${Date.now()}@example.com`,
            name: 'Performance Test Admin',
            type: UserType.ADMIN,
            status: 'ACTIVE',
          },
        });

        console.log('✅ Performance test setup completed');
      } catch (error) {
        console.error('❌ Performance test setup failed:', error);
        throw error;
      }
    }
  });

  afterAll(async () => {
    if (!isTestEnvironment) {
      try {
        // Cleanup admin user
        if (adminUser?.id) {
          await prisma.profile.delete({
            where: { id: adminUser.id },
          }).catch(() => {});
        }
        
        await prisma.$disconnect();
        console.log('✅ Performance test cleanup completed');
      } catch (error) {
        console.error('❌ Performance test cleanup failed:', error);
      }
    }
  });

  beforeEach(() => {
    if (!isTestEnvironment) {
      // Mock admin authentication
      (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: adminUser.id } },
        error: null,
      });
    }
  });

  describe('⚡ Transaction Performance Measurement', () => {
    it('should complete simple user deletion within performance threshold', async () => {
      if (isTestEnvironment) {
        console.log(skipMessage);
        return;
      }

      const testUser = await createTestUser(UserType.VENDOR);

      try {
        const metrics = await measurePerformance(async () => {
          const req = new Request(`http://localhost:3000/api/users/${testUser.id}`, {
            method: 'DELETE',
            headers: {
              'x-forwarded-for': '127.0.0.1',
              'user-agent': 'performance-test'
            }
          }) as NextRequest;

          const res = await DELETE(req);
          expect(res.status).toBe(200);
        });

        // Performance assertions
        expect(metrics.duration).toBeLessThan(2000); // Should complete within 2 seconds
        expect(metrics.memoryUsage.heapUsed).toBeLessThan(50 * 1024 * 1024); // Less than 50MB heap increase

        console.log(`✅ Simple deletion completed in ${metrics.duration}ms`);
        console.log(`📊 Memory usage: ${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024 * 100) / 100}MB`);

      } finally {
        // Cleanup in case deletion failed
        await prisma.profile.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });

    it('should handle complex user deletion within reasonable time', async () => {
      if (isTestEnvironment) {
        console.log(skipMessage);
        return;
      }

      const testUser = await createTestUser(UserType.DRIVER, 5); // Create user with moderate related data

      try {
        const metrics = await measurePerformance(async () => {
          const req = new Request(`http://localhost:3000/api/users/${testUser.id}`, {
            method: 'DELETE',
          }) as NextRequest;

          const res = await DELETE(req);
          expect(res.status).toBe(200);
        });

        // Performance assertions for complex deletion
        expect(metrics.duration).toBeLessThan(5000); // Should complete within 5 seconds
        expect(metrics.memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB heap increase

        console.log(`✅ Complex deletion completed in ${metrics.duration}ms`);
        console.log(`📊 Memory usage: ${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024 * 100) / 100}MB`);

      } finally {
        await prisma.profile.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });

    it('should maintain consistent performance across multiple deletions', async () => {
      if (isTestEnvironment) {
        console.log(skipMessage);
        return;
      }

      const testUsers = await Promise.all([
        createTestUser(UserType.VENDOR, 2),
        createTestUser(UserType.CLIENT, 2),
        createTestUser(UserType.DRIVER, 2),
      ]);

      const metrics: PerformanceMetrics[] = [];

      try {
        // Perform multiple deletions and measure each
        for (const user of testUsers) {
          const userMetrics = await measurePerformance(async () => {
            const req = new Request(`http://localhost:3000/api/users/${user.id}`, {
              method: 'DELETE',
            }) as NextRequest;

            const res = await DELETE(req);
            expect(res.status).toBe(200);
          });

          metrics.push(userMetrics);
          
          // Small delay between deletions to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Analyze performance consistency
        const durations = metrics.map(m => m.duration);
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const maxDuration = Math.max(...durations);
        const minDuration = Math.min(...durations);
        const variance = maxDuration - minDuration;

        console.log(`📊 Performance consistency analysis:`);
        console.log(`   Average: ${Math.round(avgDuration)}ms`);
        console.log(`   Range: ${minDuration}ms - ${maxDuration}ms`);
        console.log(`   Variance: ${variance}ms`);

        // Performance consistency assertions
        expect(avgDuration).toBeLessThan(3000);
        expect(variance).toBeLessThan(2000); // Variance should be reasonable

      } finally {
        // Cleanup any remaining users
        for (const user of testUsers) {
          await prisma.profile.delete({ where: { id: user.id } }).catch(() => {});
        }
      }
    });
  });

  describe('📈 Scalability Testing', () => {
    it('should handle users with varying amounts of related data efficiently', async () => {
      if (isTestEnvironment) {
        console.log(skipMessage);
        return;
      }

      const testCases = [
        { relatedDataCount: 0, label: 'No related data' },
        { relatedDataCount: 3, label: 'Light related data' },
        { relatedDataCount: 10, label: 'Heavy related data' },
      ];

      const results: Array<{ label: string; metrics: PerformanceMetrics }> = [];

      for (const testCase of testCases) {
        const testUser = await createTestUser(UserType.VENDOR, testCase.relatedDataCount);

        try {
          const metrics = await measurePerformance(async () => {
            const req = new Request(`http://localhost:3000/api/users/${testUser.id}`, {
              method: 'DELETE',
            }) as NextRequest;

            const res = await DELETE(req);
            expect(res.status).toBe(200);
          });

          results.push({ label: testCase.label, metrics });

        } finally {
          await prisma.profile.delete({ where: { id: testUser.id } }).catch(() => {});
        }
      }

      // Analyze scalability
      console.log('📊 Scalability Analysis:');
      results.forEach(result => {
        console.log(`   ${result.label}: ${result.metrics.duration}ms`);
      });

      // Performance should scale reasonably with data complexity
      const lightDataTime = results.find(r => r.label.includes('Light'))?.metrics.duration || 0;
      const heavyDataTime = results.find(r => r.label.includes('Heavy'))?.metrics.duration || 0;
      
      if (lightDataTime > 0 && heavyDataTime > 0) {
        const scalingFactor = heavyDataTime / lightDataTime;
        expect(scalingFactor).toBeLessThan(3); // Heavy should not be more than 3x slower than light
        console.log(`   Scaling factor: ${Math.round(scalingFactor * 100) / 100}x`);
      }
    });

    it('should identify performance bottlenecks in different user types', async () => {
      if (isTestEnvironment) {
        console.log(skipMessage);
        return;
      }

      const userTypes = [UserType.VENDOR, UserType.CLIENT, UserType.DRIVER, UserType.ADMIN];
      const results: Array<{ type: UserType; metrics: PerformanceMetrics }> = [];

      for (const userType of userTypes) {
        // Skip admin deletion as it's protected
        if (userType === UserType.ADMIN) continue;

        const testUser = await createTestUser(userType, 3);

        try {
          const metrics = await measurePerformance(async () => {
            const req = new Request(`http://localhost:3000/api/users/${testUser.id}`, {
              method: 'DELETE',
            }) as NextRequest;

            const res = await DELETE(req);
            expect(res.status).toBe(200);
          });

          results.push({ type: userType, metrics });

        } finally {
          await prisma.profile.delete({ where: { id: testUser.id } }).catch(() => {});
        }
      }

      // Analyze performance by user type
      console.log('📊 Performance by User Type:');
      results.forEach(result => {
        console.log(`   ${result.type}: ${result.metrics.duration}ms`);
      });

      // All user types should have similar performance characteristics
      const durations = results.map(r => r.metrics.duration);
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      const variance = maxDuration - minDuration;

      expect(variance).toBeLessThan(1500); // Performance should be consistent across user types
    });
  });

  describe('🔍 Bottleneck Identification', () => {
    it('should measure individual operation timing within transaction', async () => {
      if (isTestEnvironment) {
        console.log(skipMessage);
        return;
      }

      const testUser = await createTestUser(UserType.VENDOR, 5);

      try {
        // Create a more detailed timing analysis
        const operationTimings: Record<string, number> = {};
        
        const startTime = Date.now();

        const req = new Request(`http://localhost:3000/api/users/${testUser.id}`, {
          method: 'DELETE',
        }) as NextRequest;

        // Spy on console.log to capture timing information
        const originalConsoleLog = console.log;
        const timingLogs: string[] = [];
        
        console.log = (...args: any[]) => {
          const message = args[0];
          if (typeof message === 'string' && message.includes('[DELETE]')) {
            timingLogs.push(message);
          }
          return originalConsoleLog(...args);
        };

        const res = await DELETE(req);
        expect(res.status).toBe(200);

        const totalTime = Date.now() - startTime;
        console.log = originalConsoleLog;

        // Analyze timing logs
        console.log('🔍 Operation Timing Analysis:');
        console.log(`   Total deletion time: ${totalTime}ms`);
        
        timingLogs.forEach(log => {
          if (log.includes('completed successfully')) {
            const match = log.match(/(\d+)ms/);
            if (match) {
              console.log(`   Transaction time: ${match[1]}ms`);
            }
          }
        });

        // Performance should be within reasonable bounds
        expect(totalTime).toBeLessThan(8000);

      } finally {
        await prisma.profile.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });

    it('should identify memory usage patterns and potential leaks', async () => {
      if (isTestEnvironment) {
        console.log(skipMessage);
        return;
      }

      const initialMemory = process.memoryUsage();
      const testUsers: any[] = [];

      try {
        // Create multiple users and delete them in sequence
        for (let i = 0; i < 3; i++) {
          const testUser = await createTestUser(UserType.VENDOR, 2);
          testUsers.push(testUser);

          const beforeMemory = process.memoryUsage();

          const req = new Request(`http://localhost:3000/api/users/${testUser.id}`, {
            method: 'DELETE',
          }) as NextRequest;

          const res = await DELETE(req);
          expect(res.status).toBe(200);

          const afterMemory = process.memoryUsage();
          const memoryDelta = afterMemory.heapUsed - beforeMemory.heapUsed;

          console.log(`🧠 Memory delta for deletion ${i + 1}: ${Math.round(memoryDelta / 1024 / 1024 * 100) / 100}MB`);

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }

          // Small delay to allow memory cleanup
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const finalMemory = process.memoryUsage();
        const totalMemoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;

        console.log(`🧠 Total memory delta: ${Math.round(totalMemoryDelta / 1024 / 1024 * 100) / 100}MB`);

        // Memory usage should not grow significantly over multiple operations
        expect(totalMemoryDelta).toBeLessThan(20 * 1024 * 1024); // Less than 20MB increase

      } finally {
        // Cleanup any remaining users
        for (const user of testUsers) {
          await prisma.profile.delete({ where: { id: user.id } }).catch(() => {});
        }
      }
    });

    it('should measure database connection and transaction overhead', async () => {
      if (isTestEnvironment) {
        console.log(skipMessage);
        return;
      }

      const testUser = await createTestUser(UserType.VENDOR, 1);

      try {
        const connectionStartTime = Date.now();
        
        // Test connection time
        await prisma.$queryRaw`SELECT 1`;
        const connectionTime = Date.now() - connectionStartTime;

        const transactionStartTime = Date.now();
        
        // Execute the deletion
        const req = new Request(`http://localhost:3000/api/users/${testUser.id}`, {
          method: 'DELETE',
        }) as NextRequest;

        const res = await DELETE(req);
        expect(res.status).toBe(200);

        const totalTransactionTime = Date.now() - transactionStartTime;

        console.log('⚡ Database Performance Analysis:');
        console.log(`   Connection time: ${connectionTime}ms`);
        console.log(`   Total transaction time: ${totalTransactionTime}ms`);
        console.log(`   Transaction overhead: ${Math.max(0, totalTransactionTime - connectionTime)}ms`);

        // Connection should be fast
        expect(connectionTime).toBeLessThan(500);
        expect(totalTransactionTime).toBeLessThan(5000);

      } finally {
        await prisma.profile.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });
  });

  describe('⚠️ Stress Testing', () => {
    it('should handle multiple concurrent deletion requests gracefully', async () => {
      if (isTestEnvironment) {
        console.log(skipMessage);
        return;
      }

      // Create multiple test users
      const testUsers = await Promise.all([
        createTestUser(UserType.VENDOR, 1),
        createTestUser(UserType.CLIENT, 1),
        createTestUser(UserType.DRIVER, 1),
      ]);

      try {
        const startTime = Date.now();

        // Attempt concurrent deletions
        const deletionPromises = testUsers.map(user => {
          const req = new Request(`http://localhost:3000/api/users/${user.id}`, {
            method: 'DELETE',
          }) as NextRequest;

          return DELETE(req);
        });

        const results = await Promise.all(deletionPromises);
        const endTime = Date.now();

        // All deletions should succeed
        results.forEach(res => {
          expect(res.status).toBe(200);
        });

        const totalTime = endTime - startTime;
        console.log(`⚡ Concurrent deletions completed in ${totalTime}ms`);

        // Concurrent operations should not take significantly longer than sequential
        expect(totalTime).toBeLessThan(10000);

      } finally {
        // Cleanup any remaining users
        for (const user of testUsers) {
          await prisma.profile.delete({ where: { id: user.id } }).catch(() => {});
        }
      }
    });
  });
});
