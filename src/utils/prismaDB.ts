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

export async function connectPrisma(): Promise<void> {
  try {
    console.log('🔌 Attempting to connect to database...');
    await prismaPooled.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw new Error(`Failed to connect to database: ${error}`);
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

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prismaPooled.$queryRaw`SELECT 1`;
    console.log('💚 Database health check passed');
    return true;
  } catch (error) {
    console.error('💔 Database health check failed:', error);
    return false;
  }
}

// Types for better TypeScript support
export type PrismaClientInstance = typeof prismaPooled;
export type PrismaTransaction = Parameters<Parameters<typeof prismaPooled.$transaction>[0]>[0];
