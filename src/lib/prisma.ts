import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Add pgbouncer params for Supabase pooler connections to avoid
// "prepared statement does not exist" errors
function getDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? '';
  if (raw.includes('supabase.com') || raw.includes('pooler.supabase.com')) {
    const url = new URL(raw);
    url.searchParams.set('pgbouncer', 'true');
    url.searchParams.set('statement_cache_size', '0');
    return url.toString();
  }
  return raw;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: getDatabaseUrl()
      }
    }
  });

// Graceful shutdown handling
if (typeof window === 'undefined') {
  // Server-side only
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
