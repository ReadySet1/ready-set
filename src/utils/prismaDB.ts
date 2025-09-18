import { PrismaClient } from '@prisma/client';
import { prismaLogger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Environment checks
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

prismaLogger.debug('🔧 Prisma Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_RUNTIME: process.env.NEXT_RUNTIME,
  hasDatabase: !!process.env.DATABASE_URL,
  databasePreview: process.env.DATABASE_URL ? 
    `${process.env.DATABASE_URL.substring(0, 20)}...` : 'NOT SET'
});

// Create Prisma client with optimized configuration
function createPrismaClient(): PrismaClient {
  prismaLogger.debug('🟢 Creating new Prisma client...');
  
  // Test environment - minimal configuration
  if (isTest) {
    prismaLogger.debug('🧪 Test environment - using basic client');
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
    prismaLogger.debug('🚀 Production environment - optimized client');
    return new PrismaClient({
      log: ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
    });
  }

  // Development environment - full logging with connection stability
  prismaLogger.debug('🔧 Development environment - debug client');
  
  // Modify database URL to disable prepared statements and improve connection stability in development
  const baseUrl = process.env.DATABASE_URL || '';
  const hasParams = baseUrl.includes('?');
  const devParams = [
    'statement_cache_size=0',
    'prepared_statements=false',
    'connection_limit=10',
    'pool_timeout=60',
    'pgbouncer=true'
  ].join('&');
  
  const devDatabaseUrl = baseUrl + (hasParams ? '&' : '?') + devParams;
  
  return new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    datasources: {
      db: {
        url: devDatabaseUrl
      }
    },
    // Add connection stability for development
    transactionOptions: {
      maxWait: 30000, // 30 seconds
      timeout: 20000, // 20 seconds
    },
    // Reduce query engine restarts
    errorFormat: 'minimal'
  });
}

// Singleton pattern with global caching for development
const getPrismaClient = (): PrismaClient => {
  // In development, use global to prevent re-initialization during hot reloads
  if (isDevelopment) {
    if (!global.__prisma) {
      prismaLogger.debug('🔄 Creating new global Prisma client for development');
      global.__prisma = createPrismaClient();
    } else {
      prismaLogger.debug('♻️ Reusing existing global Prisma client');
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
      prismaLogger.debug(`🔌 Attempting to connect to database (attempt ${attempt}/${retries})...`);
      await prisma.$connect();
      prismaLogger.debug('✅ Database connected successfully');
      return;
    } catch (error) {
      console.error(`❌ Database connection failed on attempt ${attempt}:`, error);
      
      if (attempt === retries) {
        throw new Error(`Failed to connect to database after ${retries} attempts: ${error}`);
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      prismaLogger.debug(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export async function disconnectPrisma(): Promise<void> {
  try {
    prismaLogger.debug('🔌 Disconnecting from database...');
    await prisma.$disconnect();
    prismaLogger.debug('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
  }
}

// Health check function with automatic reconnection
export async function checkDatabaseHealth(autoReconnect = true): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    prismaLogger.debug('💚 Database health check passed');
    return true;
  } catch (error) {
    console.error('💔 Database health check failed:', error);
    
    if (autoReconnect && isDevelopment) {
      prismaLogger.debug('🔄 Attempting to reconnect...');
      try {
        await disconnectPrisma();
        await connectPrisma();
        // Test again after reconnection
        await prisma.$queryRaw`SELECT 1`;
        prismaLogger.debug('✅ Database reconnected successfully');
        return true;
      } catch (reconnectError) {
        console.error('❌ Failed to reconnect:', reconnectError);
      }
    }
    
    return false;
  }
}

// Check if error is related to prepared statements
function isPreparedStatementError(error: any): boolean {
  return error?.code === '42P05' || // prepared statement already exists
         error?.code === '26000' || // prepared statement does not exist
         error?.message?.includes('prepared statement') ||
         error?.message?.includes('already exists') ||
         error?.message?.includes('does not exist');
}

// Global flag to prevent concurrent connection resets
let isResettingConnection = false;

// Reset Prisma connection to clear prepared statements
export async function resetPrismaConnection(): Promise<void> {
  // If already resetting, wait for it to complete
  if (isResettingConnection) {
    prismaLogger.debug('⏳ Connection reset already in progress, waiting...');
    let waitCount = 0;
    while (isResettingConnection && waitCount < 100) { // Max 10 seconds wait
      await new Promise(resolve => setTimeout(resolve, 100));
      waitCount++;
    }
    return;
  }

  isResettingConnection = true;
  try {
    prismaLogger.debug('🔄 Resetting Prisma connection to clear prepared statements...');
    
    // In development, recreate the global client to clear all state
    if (isDevelopment && global.__prisma) {
      try {
        await global.__prisma.$disconnect();
      } catch (disconnectError) {
        console.warn('⚠️ Error during disconnect, continuing with reset:', disconnectError);
      }
      
      global.__prisma = undefined;
      prismaLogger.debug('🔄 Cleared global Prisma client in development');
      
      // Wait for the connection to fully close
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Recreate the client
      global.__prisma = createPrismaClient();
      
      // Test the new connection with retry
      let testRetries = 3;
      while (testRetries > 0) {
        try {
          await global.__prisma.$queryRaw`SELECT 1`;
          break;
        } catch (testError) {
          testRetries--;
          if (testRetries === 0) throw testError;
          prismaLogger.debug(`🔄 Connection test failed, retrying... (${testRetries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else {
      // For production, just disconnect and reconnect
      try {
        await prisma.$disconnect();
      } catch (disconnectError) {
        console.warn('⚠️ Error during disconnect, continuing with reset:', disconnectError);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
    }
    
    prismaLogger.debug('✅ Prisma connection reset successfully');
  } catch (error) {
    console.error('❌ Failed to reset Prisma connection:', error);
    // Don't throw here to prevent cascade failures
  } finally {
    isResettingConnection = false;
  }
}

// Wrapper function for database operations with automatic retry
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  operationName = 'database operation'
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      const isConnectionError = error?.code === 'P2028' || 
                               error?.message?.includes('Engine is not yet connected') ||
                               error?.message?.includes('Connection refused') ||
                               error?.message?.includes('Response from the Engine was empty') ||
                               error?.message?.includes('Connection terminated');
      
      const isPreparedStmtError = isPreparedStatementError(error);
      
      // Log the specific error details
      console.error(`❌ ${operationName} failed on attempt ${attempt}:`, {
        code: error?.code,
        message: error?.message?.substring(0, 200),
        isPreparedStmtError,
        isConnectionError
      });
      
      if ((isConnectionError || isPreparedStmtError) && attempt <= maxRetries) {
        prismaLogger.debug(`🔄 Database ${isPreparedStmtError ? 'prepared statement' : 'connection'} error on attempt ${attempt}, retrying...`);
        
        // For prepared statement errors, reset the connection
        if (isPreparedStmtError) {
          try {
            await resetPrismaConnection();
          } catch (resetError) {
            console.error('❌ Connection reset failed:', resetError);
            // Continue to retry even if reset fails
          }
        } else {
          // Attempt to reconnect for connection errors
          try {
            await disconnectPrisma();
            await connectPrisma();
          } catch (reconnectError) {
            console.error('❌ Reconnection failed:', reconnectError);
            // Continue to retry even if reconnection fails
          }
        }
        
        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 5000);
        prismaLogger.debug(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If we're here, either it's not a retryable error or we've exhausted retries
      console.error(`💥 ${operationName} failed after ${attempt} attempts. Final error:`, error);
      throw error;
    }
  }
  
  throw lastError || new Error('Unreachable code in withDatabaseRetry');
}

// Graceful shutdown for serverless
if (isProduction) {
  process.on('beforeExit', async () => {
    prismaLogger.debug('🔄 Gracefully shutting down Prisma client...');
    await disconnectPrisma();
  });
}

// Export default for compatibility
export default prisma;

// Types for better TypeScript support
export type PrismaClientInstance = typeof prisma;
export type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
