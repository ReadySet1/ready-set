import { PrismaClient } from '@prisma/client';
import { loggers } from '@/utils/logger';
import { softDeleteMiddleware, softDeleteProfile, restoreProfile, isProfileSoftDeleted } from '@/lib/prisma/middleware/softDelete';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Environment checks
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Environment logging using centralized logger
loggers.prisma.debug('Prisma Environment initialized', {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_RUNTIME: process.env.NEXT_RUNTIME,
  hasDatabase: !!process.env.DATABASE_URL,
  databasePreview: process.env.DATABASE_URL ? 
    `${process.env.DATABASE_URL.substring(0, 20)}...` : 'NOT SET'
});

// Create Prisma client with optimized configuration
function createPrismaClient(): PrismaClient {
  let client: PrismaClient;

  // Test environment - minimal configuration
  if (isTest) {
    client = new PrismaClient({
      log: ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test'
        }
      }
    });
  }
  // Production environment - optimized for serverless
  else if (isProduction) {
    client = new PrismaClient({
      log: ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      // Optimize for serverless environments
      // @ts-ignore - This is a valid Prisma option for serverless
      __internal: {
        engine: {
          closePromise: () => Promise.resolve(),
        },
      },
    });
  }
  // Development environment - full logging
  else {
    client = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
  }

  // Apply soft delete middleware
  client.$use(softDeleteMiddleware);

  return client;
}

// Singleton pattern with global caching for development
const getPrismaClient = (): PrismaClient => {
  // In development, use global to prevent re-initialization during hot reloads
  if (isDevelopment) {
    if (!global.__prisma) {
      global.__prisma = createPrismaClient();
    }
    return global.__prisma;
  }

  // In production/test, create new instance each time
  return createPrismaClient();
};

// Export the singleton instance
export const prisma = getPrismaClient();

// Enhanced connection management
export async function connectPrisma(): Promise<void> {
  try {
    await prisma.$connect();
    loggers.prisma.info('Database connected successfully');
  } catch (error) {
    loggers.prisma.error('Database connection failed', error);
    throw new Error(`Failed to connect to database: ${error}`);
  }
}

export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    loggers.prisma.info('Database disconnected successfully');
  } catch (error) {
    loggers.prisma.error('Database disconnection failed', error);
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    loggers.prisma.info('Database health check passed');
    return true;
  } catch (error) {
    loggers.prisma.error('Database health check failed', error);
    return false;
  }
}

// Graceful shutdown for serverless
if (isProduction) {
  process.on('beforeExit', async () => {
    await disconnectPrisma();
  });
}

// Soft delete helper methods
export const softDeleteHelpers = {
  /**
   * Soft delete a Profile record
   */
  async deleteProfile(profileId: string): Promise<void> {
    await softDeleteProfile(prisma, profileId);
  },

  /**
   * Restore a soft-deleted Profile record
   */
  async restoreProfile(profileId: string): Promise<void> {
    await restoreProfile(prisma, profileId);
  },

  /**
   * Check if a Profile is soft-deleted
   */
  async isProfileSoftDeleted(profileId: string): Promise<boolean> {
    return await isProfileSoftDeleted(prisma, profileId);
  },

  /**
   * Find active (non-deleted) profiles
   */
  async findManyActive(args?: any) {
    return prisma.profile.findMany({
      ...args,
      where: {
        ...args?.where,
        deletedAt: null
      }
    });
  },

  /**
   * Find first active (non-deleted) profile
   */
  async findFirstActive(args?: any) {
    return prisma.profile.findFirst({
      ...args,
      where: {
        ...args?.where,
        deletedAt: null
      }
    });
  },

  /**
   * Find unique active (non-deleted) profile
   */
  async findUniqueActive(args: any) {
    return prisma.profile.findUnique({
      ...args,
      where: {
        ...args.where,
        deletedAt: null
      }
    });
  },

  /**
   * Count active (non-deleted) profiles
   */
  async countActive(args?: any) {
    return prisma.profile.count({
      ...args,
      where: {
        ...args?.where,
        deletedAt: null
      }
    });
  },

  /**
   * Find profiles including soft-deleted ones
   */
  async findManyIncludingDeleted(args?: any) {
    return prisma.profile.findMany({
      ...args,
      includeDeleted: true
    });
  },

  /**
   * Find first profile including soft-deleted ones
   */
  async findFirstIncludingDeleted(args?: any) {
    return prisma.profile.findFirst({
      ...args,
      includeDeleted: true
    });
  },

  /**
   * Find unique profile including soft-deleted ones
   */
  async findUniqueIncludingDeleted(args: any) {
    return prisma.profile.findUnique({
      ...args,
      includeDeleted: true
    });
  }
};

// Export default for compatibility
export default prisma;

// Types for better TypeScript support
export type PrismaClientInstance = typeof prisma;
export type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
