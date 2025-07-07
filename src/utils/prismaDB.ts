import { PrismaClient } from '@prisma/client'

/**
 * Simplified PrismaClient instantiation
 */

// Define the global type that will hold our PrismaClient instance
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// Environment checks
const isDevelopment = process.env.NODE_ENV === 'development'
const databaseUrl = process.env.DATABASE_URL

// Debug environment
console.log('Prisma Environment Check:', {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_RUNTIME: process.env.NEXT_RUNTIME,
  hasDataBaseUrl: !!databaseUrl,
  databaseUrlPreview: databaseUrl ? databaseUrl.substring(0, 20) + '...' : 'NOT SET'
})

// Create Prisma client
const createPrismaClient = (): PrismaClient => {
  console.log('🟢 Creating Prisma client')
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not defined. Please check your environment variables.')
    throw new Error('DATABASE_URL is not defined. Please check your environment variables.')
  }

  return new PrismaClient({
    log: isDevelopment ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });
};

// Create the Prisma instance
const prisma = globalThis.prismaGlobal ?? createPrismaClient()

// Store in global for development hot reload
if (isDevelopment) {
  globalThis.prismaGlobal = prisma;
}

// Export the client
export { prisma };

// Export default for compatibility
export default prisma;

// Simple manager for compatibility
export const PrismaClientManager = {
  getInstance: () => prisma,
  resetInstance: () => {
    globalThis.prismaGlobal = undefined;
  }
};