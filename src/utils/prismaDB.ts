import { PrismaClient } from '@prisma/client'

/**
 * PrismaClient instantiation with build-time safety for Next.js
 * Uses a mock client during build and real client during runtime
 */

// Define the global type that will hold our PrismaClient instance
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// Check if we're in a build environment
const isBuildTime = process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL;

// Create a mock Prisma client for build time
const createMockPrismaClient = (): PrismaClient => {
  const mockClient = {} as PrismaClient;
  
  // Add common Prisma methods as mocks
  const models = [
    'user', 'jobApplication', 'fileUpload', 'address', 'order', 
    'driver', 'carrier', 'cateringRequest', 'profile'
  ];
  
  models.forEach(model => {
    (mockClient as any)[model] = {
      findMany: () => Promise.resolve([]),
      findUnique: () => Promise.resolve(null),
      findFirst: () => Promise.resolve(null),
      create: () => Promise.resolve({}),
      update: () => Promise.resolve({}),
      delete: () => Promise.resolve({}),
      count: () => Promise.resolve(0),
      groupBy: () => Promise.resolve([]),
      aggregate: () => Promise.resolve({}),
      deleteMany: () => Promise.resolve({ count: 0 }),
      updateMany: () => Promise.resolve({ count: 0 }),
      upsert: () => Promise.resolve({}),
    };
  });
  
  // Add transaction method
  (mockClient as any).$transaction = (fn: any) => {
    if (typeof fn === 'function') {
      return fn(mockClient);
    }
    return Promise.resolve([]);
  };
  
  // Add other common methods
  (mockClient as any).$connect = () => Promise.resolve();
  (mockClient as any).$disconnect = () => Promise.resolve();
  (mockClient as any).$executeRaw = () => Promise.resolve(0);
  (mockClient as any).$queryRaw = () => Promise.resolve([]);
  
  return mockClient;
};

// Create real Prisma client
const createRealPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn']
      : ['error'],
  });
};

// Create appropriate client based on environment
const createPrismaClient = (): PrismaClient => {
  if (isBuildTime) {
    console.log('Using mock Prisma client for build time');
    return createMockPrismaClient();
  }
  
  try {
    return createRealPrismaClient();
  } catch (error) {
    console.error('Failed to create Prisma client, falling back to mock:', error);
    return createMockPrismaClient();
  }
};

// Singleton pattern for client management
class PrismaClientManager {
  private static instance: PrismaClient | undefined;
  
  static getInstance(): PrismaClient {
    // Return existing instance if available
    if (PrismaClientManager.instance) {
      return PrismaClientManager.instance;
    }
    
    // Check global instance
    if (globalThis.prismaGlobal) {
      PrismaClientManager.instance = globalThis.prismaGlobal;
      return PrismaClientManager.instance;
    }
    
    // Create new instance
    PrismaClientManager.instance = createPrismaClient();
    
    // Store in global for development
    if (process.env.NODE_ENV !== 'production') {
      globalThis.prismaGlobal = PrismaClientManager.instance;
    }
    
    return PrismaClientManager.instance;
  }
}

// Export the singleton instance
export const prisma = PrismaClientManager.getInstance();

export default prisma;