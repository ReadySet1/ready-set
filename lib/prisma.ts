import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// Create Prisma client with proper error handling
function createPrismaClient() {
  if (typeof window !== 'undefined') {
    throw new Error('PrismaClient should not be used on the client side');
  }
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn']
      : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}

// Initialize Prisma Client with singleton pattern
// Prevent multiple instances of Prisma Client in development
const prismaInstance = globalThis.prismaGlobal || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prismaInstance;
}

// Use named export instead of default
export const prisma = prismaInstance; 