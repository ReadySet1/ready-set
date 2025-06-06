import { PrismaClient } from '@prisma/client'

/**
 * PrismaClient instantiation with improved singleton pattern for Vercel deployment
 * and optimized logging configuration
 */

// Define the global type that will hold our PrismaClient instance
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// Prevent multiple instances of Prisma Client in development mode
export const prisma = globalThis.prismaGlobal || 
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? [
          'error',
          'warn',
          // Reduce query logging verbosity - only log in development when needed
        ]
      : ['error'],
  });

// If we're not in production, attach prisma to the global object
if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export default prisma;