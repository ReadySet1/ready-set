import { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'

/**
 * Optimized Prisma Client with Connection Pooling
 * Replaces the basic implementation with production-ready configuration
 */

// Define global type for our optimized Prisma instance
declare global {
  // eslint-disable-next-line no-var
  var prismaPooled: PrismaClient | undefined;
}

// Environment configuration
const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'
const databaseUrl = process.env.DATABASE_URL
const directUrl = process.env.DIRECT_URL

// Connection pooling configuration
const POOL_CONFIG = {
  // Connection pool limits
  connectionLimit: isProduction ? 20 : 10,
  maxIdleTime: 300, // 5 minutes
  maxConnections: isProduction ? 50 : 25,
  
  // Query timeouts
  queryTimeout: 30000, // 30 seconds
  transactionTimeout: 60000, // 1 minute
  
  // Connection timeouts
  connectTimeout: 10000, // 10 seconds
  acquireTimeout: 60000, // 1 minute
}

// Enhanced logging configuration
const LOG_CONFIG: any[] = isDevelopment 
  ? ['query', 'error', 'warn', 'info']
  : ['error', 'warn']

// Create a mock Prisma client for build-time
const createMockPrismaClient = (): PrismaClient => {
  console.log('⚠️ Creating mock Prisma client for build-time analysis (pooled)')
  
  // Create a mock client with all the necessary methods
  const mockClient = {
    // Add all the models as empty objects with basic methods
    jobApplication: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      groupBy: async () => [],
    },
    profile: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    order: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    cateringRequest: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    fileUpload: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    // Add other models as needed
    $connect: async () => {},
    $disconnect: async () => {},
    $transaction: async (fn: any) => fn(mockClient),
    $queryRaw: async () => [],
  } as any as PrismaClient

  return mockClient
}

// Create optimized Prisma client with connection pooling
const createOptimizedPrismaClient = (): PrismaClient => {
  console.log('🔄 Creating optimized Prisma client with connection pooling...')
  
  // During build time, we might not have a database connection
  if (isBuildTime) {
    return createMockPrismaClient()
  }
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not defined. Please check your environment variables.')
    throw new Error('DATABASE_URL is not defined. Please check your environment variables.')
  }

  // Build connection string with pooling parameters
  const pooledUrl = new URL(databaseUrl)
  
  // Add connection pooling parameters
  pooledUrl.searchParams.set('connection_limit', POOL_CONFIG.connectionLimit.toString())
  pooledUrl.searchParams.set('pool_timeout', '30')
  pooledUrl.searchParams.set('pgbouncer', 'true')
  pooledUrl.searchParams.set('statement_cache_size', '0')
  
  // Add performance optimizations
  pooledUrl.searchParams.set('connect_timeout', '10')
  pooledUrl.searchParams.set('socket_timeout', '30')

  const client = new PrismaClient({
    log: LOG_CONFIG,
    datasources: {
      db: {
        url: pooledUrl.toString()
      }
    },
    errorFormat: isDevelopment ? 'pretty' : 'minimal',
    transactionOptions: {
      maxWait: POOL_CONFIG.acquireTimeout,
      timeout: POOL_CONFIG.transactionTimeout,
      isolationLevel: 'ReadCommitted'
    }
  });

  // Enhanced error handling and query monitoring
  // Note: Event listeners temporarily disabled due to TypeScript compatibility
  // TODO: Implement proper event monitoring after Prisma client type fixes

  // Connection management
  console.log('✅ Optimized Prisma client created with configuration:', {
    connectionLimit: POOL_CONFIG.connectionLimit,
    environment: process.env.NODE_ENV,
    pooling: 'enabled',
    directConnection: !!directUrl
  })

  return client
}

// Singleton pattern with connection pooling
let prismaPooled: PrismaClient

try {
  // Use global instance if available (for development hot reload)
  if (globalThis.prismaPooled) {
    prismaPooled = globalThis.prismaPooled
    console.log('🔄 Using existing global Prisma pooled client')
  } else {
    prismaPooled = createOptimizedPrismaClient()
    
    // Store in global for development hot reload
    if (isDevelopment && !isBuildTime) {
      globalThis.prismaPooled = prismaPooled
      console.log('💾 Stored Prisma pooled client in global for development')
    }
  }
} catch (error) {
  console.error('❌ Failed to initialize Prisma pooled client:', error)
  
  // In production build, create a mock client for build-time analysis
  if (isBuildTime) {
    console.log('⚠️ Creating mock Prisma pooled client for build-time analysis')
    prismaPooled = createMockPrismaClient()
  } else {
    throw error
  }
}

// Graceful shutdown handling
const handleShutdown = async () => {
  console.log('🔄 Gracefully disconnecting Prisma client...')
  await prismaPooled.$disconnect()
  console.log('✅ Prisma client disconnected')
}

// Register shutdown handlers
if (typeof process !== 'undefined') {
  process.on('SIGTERM', handleShutdown)
  process.on('SIGINT', handleShutdown)
  process.on('beforeExit', handleShutdown)
}

/**
 * Performance monitoring utilities
 */
export const queryMetrics = {
  async measureQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now()
    
    try {
      const result = await queryFn()
      const duration = performance.now() - startTime
      
      if (duration > 500) {
        console.warn(`⚠️ Slow query detected: ${queryName} (${duration.toFixed(2)}ms)`)
      }
      
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      console.error(`❌ Query failed: ${queryName} (${duration.toFixed(2)}ms)`, error)
      throw error
    }
  }
}

/**
 * Connection health check
 */
export const healthCheck = {
  async checkConnection(): Promise<boolean> {
    try {
      await prismaPooled.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error('❌ Database connection check failed:', error)
      return false
    }
  },

  async getConnectionInfo() {
    try {
      const result = await prismaPooled.$queryRaw<Array<{ count: number }>>`
        SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()
      `
      return {
        activeConnections: result[0]?.count || 0,
        maxConnections: POOL_CONFIG.maxConnections,
        healthy: true
      }
    } catch (error) {
      return {
        activeConnections: 0,
        maxConnections: POOL_CONFIG.maxConnections,
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Export the optimized client
export { prismaPooled }
export default prismaPooled 