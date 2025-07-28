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
const LOG_CONFIG: Prisma.LogLevel[] = isDevelopment 
  ? ['query', 'error', 'warn', 'info']
  : ['error', 'warn']

// Create optimized Prisma client with connection pooling
const createOptimizedPrismaClient = (): PrismaClient => {
  console.log('🔄 Creating optimized Prisma client with connection pooling...')
  
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
const prismaPooled = globalThis.prismaPooled ?? createOptimizedPrismaClient()

// Store in global for development hot reload
if (isDevelopment) {
  globalThis.prismaPooled = prismaPooled
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