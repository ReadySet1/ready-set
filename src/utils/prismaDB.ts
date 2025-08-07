import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Environment checks
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

console.log('🔧 Prisma Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_RUNTIME: process.env.NEXT_RUNTIME,
  hasDatabase: !!process.env.DATABASE_URL,
  databasePreview: process.env.DATABASE_URL ? 
    `${process.env.DATABASE_URL.substring(0, 20)}...` : 'NOT SET'
});

// Create Prisma client with optimized configuration
function createPrismaClient(): PrismaClient {
  console.log('🟢 Creating new Prisma client...');
  
  // Test environment - minimal configuration
  if (isTest) {
    console.log('🧪 Test environment - using basic client');
    return new PrismaClient({
      log: ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test'
        }
      }
    });
  }

  // Production environment - optimized for serverless
  if (isProduction) {
    console.log('🚀 Production environment - optimized client');
    return new PrismaClient({
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
  console.log('🔧 Development environment - debug client');
  return new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });
}

// Singleton pattern with global caching for development
const getPrismaClient = (): PrismaClient => {
  // In development, use global to prevent re-initialization during hot reloads
  if (isDevelopment) {
    if (!global.__prisma) {
      console.log('🔄 Creating new global Prisma client for development');
      global.__prisma = createPrismaClient();
    } else {
      console.log('♻️ Reusing existing global Prisma client');
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
    console.log('🔌 Attempting to connect to database...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw new Error(`Failed to connect to database: ${error}`);
  }
}

export async function disconnectPrisma(): Promise<void> {
  try {
    console.log('🔌 Disconnecting from database...');
    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('💚 Database health check passed');
    return true;
  } catch (error) {
    console.error('💔 Database health check failed:', error);
    return false;
  }
}

// Graceful shutdown for serverless
if (isProduction) {
  process.on('beforeExit', async () => {
    console.log('🔄 Gracefully shutting down Prisma client...');
    await disconnectPrisma();
  });
}

// Export default for compatibility
export default prisma;

// Types for better TypeScript support
export type PrismaClientInstance = typeof prisma;
export type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
