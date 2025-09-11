import { PrismaClient } from '@prisma/client';
import { loggers } from '@/utils/logger';

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
  // Test environment - minimal configuration
  if (isTest) {
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

  // Development environment - full logging with connection stability
  console.log('🔧 Development environment - debug client');
  return new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    // Add connection stability for development
    transactionOptions: {
      maxWait: 60000, // 1 minute
      timeout: 30000, // 30 seconds
    },
  });
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

// Enhanced connection management with retry logic
export async function connectPrisma(retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔌 Attempting to connect to database (attempt ${attempt}/${retries})...`);
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return;
    } catch (error) {
      console.error(`❌ Database connection failed on attempt ${attempt}:`, error);
      
      if (attempt === retries) {
        throw new Error(`Failed to connect to database after ${retries} attempts: ${error}`);
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
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

// Health check function with automatic reconnection
export async function checkDatabaseHealth(autoReconnect = true): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    loggers.prisma.info('Database health check passed');
    return true;
  } catch (error) {
    console.error('💔 Database health check failed:', error);
    
    if (autoReconnect && isDevelopment) {
      console.log('🔄 Attempting to reconnect...');
      try {
        await disconnectPrisma();
        await connectPrisma();
        // Test again after reconnection
        await prisma.$queryRaw`SELECT 1`;
        console.log('✅ Database reconnected successfully');
        return true;
      } catch (reconnectError) {
        console.error('❌ Failed to reconnect:', reconnectError);
      }
    }
    
    return false;
  }
}

// Wrapper function for database operations with automatic retry
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const isConnectionError = error?.code === 'P2028' || 
                               error?.message?.includes('Engine is not yet connected') ||
                               error?.message?.includes('Connection refused') ||
                               error?.message?.includes('Response from the Engine was empty');
      
      if (isConnectionError && attempt <= maxRetries && isDevelopment) {
        console.log(`🔄 Database connection error on attempt ${attempt}, retrying...`);
        
        // Attempt to reconnect
        try {
          await disconnectPrisma();
          await connectPrisma();
        } catch (reconnectError) {
          console.error('❌ Reconnection failed:', reconnectError);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      throw error;
    }
  }
  
  throw new Error('Unreachable code');
}

// Graceful shutdown for serverless
if (isProduction) {
  process.on('beforeExit', async () => {
    await disconnectPrisma();
  });
}

// Export default for compatibility
export default prisma;

// Types for better TypeScript support
export type PrismaClientInstance = typeof prisma;
export type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
