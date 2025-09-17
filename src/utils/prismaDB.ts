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
    console.log('🔌 Disconnecting from database...');
    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
  }
}

// Health check function with automatic reconnection
export async function checkDatabaseHealth(autoReconnect = true): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('💚 Database health check passed');
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

// Check if error is related to prepared statements
function isPreparedStatementError(error: any): boolean {
  return error?.code === '42P05' || // prepared statement already exists
         error?.code === '26000' || // prepared statement does not exist
         error?.message?.includes('prepared statement') ||
         error?.message?.includes('already exists') ||
         error?.message?.includes('does not exist');
}

// Reset Prisma connection to clear prepared statements
export async function resetPrismaConnection(): Promise<void> {
  try {
    console.log('🔄 Resetting Prisma connection to clear prepared statements...');
    await prisma.$disconnect();
    // Force a longer delay to ensure connection is fully closed and prepared statements are cleared
    await new Promise(resolve => setTimeout(resolve, 500));
    await prisma.$connect();
    // Test the connection with a simple query
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Prisma connection reset successfully');
  } catch (error) {
    console.error('❌ Failed to reset Prisma connection:', error);
    throw error;
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
      
      const isPreparedStmtError = isPreparedStatementError(error);
      
      if ((isConnectionError || isPreparedStmtError) && attempt <= maxRetries && isDevelopment) {
        console.log(`🔄 Database ${isPreparedStmtError ? 'prepared statement' : 'connection'} error on attempt ${attempt}, retrying...`);
        
        // For prepared statement errors, reset the connection
        if (isPreparedStmtError) {
          try {
            await resetPrismaConnection();
          } catch (resetError) {
            console.error('❌ Connection reset failed:', resetError);
          }
        } else {
          // Attempt to reconnect for connection errors
          try {
            await disconnectPrisma();
            await connectPrisma();
          } catch (reconnectError) {
            console.error('❌ Reconnection failed:', reconnectError);
          }
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
    console.log('🔄 Gracefully shutting down Prisma client...');
    await disconnectPrisma();
  });
}

// Export default for compatibility
export default prisma;

// Types for better TypeScript support
export type PrismaClientInstance = typeof prisma;
export type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
