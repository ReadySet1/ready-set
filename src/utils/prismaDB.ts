/**
 * Unified Prisma Client Export
 * 
 * This module now re-exports the optimized pooled client to fix connection issues.
 * All existing imports from '@/utils/prismaDB' will now use the connection-pooled client.
 */

// Re-export the optimized pooled client as the main export
export { prismaPooled as prisma, queryMetrics, healthCheck } from '@/lib/db/prisma-pooled';

// For backward compatibility, also export as default
export { default } from '@/lib/db/prisma-pooled';

// Legacy function exports for backward compatibility
import { prismaPooled } from '@/lib/db/prisma-pooled';

// Enhanced connection management with retry logic
export async function connectPrisma(retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔌 Attempting to connect to database (attempt ${attempt}/${retries})...`);
      await prismaPooled.$connect();
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
    await prismaPooled.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
  }
}

// Health check function with automatic reconnection
export async function checkDatabaseHealth(autoReconnect = true): Promise<boolean> {
  try {
    await prismaPooled.$queryRaw`SELECT 1`;
    console.log('💚 Database health check passed');
    return true;
  } catch (error) {
    console.error('💔 Database health check failed:', error);
    
    if (autoReconnect) {
      console.log('🔄 Attempting to reconnect...');
      try {
        await disconnectPrisma();
        await connectPrisma();
        // Test again after reconnection
        await prismaPooled.$queryRaw`SELECT 1`;
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
      
      if (isConnectionError && attempt <= maxRetries) {
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
process.on('beforeExit', async () => {
  console.log('🔄 Gracefully shutting down Prisma client...');
  await disconnectPrisma();
});
// Types for better TypeScript support
export type PrismaClientInstance = typeof prismaPooled;
export type PrismaTransaction = Parameters<Parameters<typeof prismaPooled.$transaction>[0]>[0];
