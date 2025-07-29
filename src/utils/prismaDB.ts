import { PrismaClient } from '@prisma/client'

/**
 * Simplified PrismaClient instantiation with lazy loading
 */

// Define the global type that will hold our PrismaClient instance
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// Environment checks
const isDevelopment = process.env.NODE_ENV === 'development'
const databaseUrl = process.env.DATABASE_URL

// Create Prisma client function
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

// Lazy initialization function
const getPrismaClient = (): PrismaClient => {
  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = createPrismaClient();
  }
  return globalThis.prismaGlobal;
};

// Export a proxy that lazily initializes the client
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    const client = getPrismaClient();
    return (client as any)[prop];
  }
});

// Export default for compatibility
export default prisma;

// Simple manager for compatibility
export const PrismaClientManager = {
  getInstance: () => getPrismaClient(),
  resetInstance: () => {
    if (globalThis.prismaGlobal) {
      globalThis.prismaGlobal.$disconnect();
      globalThis.prismaGlobal = undefined;
    }
  }
};