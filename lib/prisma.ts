import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// Initialize Prisma Client
// Prevent multiple instances of Prisma Client in development
const prismaInstance = globalThis.prismaGlobal || new PrismaClient({
  // Optional: Add logging configuration if needed
  // log: ['query', 'info', 'warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prismaInstance;
}

// Use named export instead of default
export const prisma = prismaInstance; 