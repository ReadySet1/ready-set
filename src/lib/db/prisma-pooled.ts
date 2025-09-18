import { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { prismaLogger } from '../../utils/logger'

/**
 * Optimized Prisma Client with Connection Pooling
 * Replaces the basic implementation with production-ready configuration
 */

// Define global type for our optimized Prisma instance
declare global {
  // eslint-disable-next-line no-var
  var prismaPooled: PrismaClient | undefined;
}

// Environment configuration - Use VERCEL_ENV for more accurate environment detection
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production'
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'
const isVercelServerless = !!process.env.VERCEL
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
  prismaLogger.debug('⚠️ Creating mock Prisma client for build-time analysis (pooled)')
  
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
      deleteMany: async () => ({}),
      groupBy: async () => [],
    },
    profile: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({}),
    },
    order: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({}),
    },
    cateringRequest: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({}),
    },
    fileUpload: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({}),
    },
    // Calculator system models
    calculatorTemplate: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({}),
    },
    pricingRule: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({}),
    },
    clientConfiguration: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({}),
    },
    calculationHistory: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({}),
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
  prismaLogger.debug('🔄 Creating optimized Prisma client with connection pooling...')
  
  // During build time, we might not have a database connection
  if (isBuildTime) {
    return createMockPrismaClient()
  }
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not defined. Please check your environment variables.')
    throw new Error('DATABASE_URL is not defined. Please check your environment variables.')
  }

  // Build connection string with serverless optimizations
  let connectionUrl = databaseUrl
  
  // For Supabase in serverless environments, optimize connection string
  if (databaseUrl.includes('supabase.co')) {
    const url = new URL(databaseUrl)
    
    if (isVercelServerless) {
      // Serverless environment optimizations for Supabase
      console.log('🔧 Configuring Supabase connection for Vercel serverless environment')
      
      // Use pgbouncer for connection pooling and disable prepared statements
      url.searchParams.set('pgbouncer', 'true')
      url.searchParams.set('statement_cache_size', '0')
      
      // Connection timeouts optimized for serverless
      url.searchParams.set('connect_timeout', '10')
      url.searchParams.set('socket_timeout', '30')
      
      // Pool configuration for serverless
      url.searchParams.set('pool_timeout', '10')
      
      connectionUrl = url.toString()
      
      console.log('✅ Applied serverless optimizations for Supabase')
    } else {
      // Local development - use direct connection for better debugging
      console.log('🔧 Using direct Supabase connection for local development')
      connectionUrl = directUrl || databaseUrl
    }
  } else {
    // Non-Supabase PostgreSQL - apply standard pooling
    const pooledUrl = new URL(databaseUrl)
    pooledUrl.searchParams.set('connection_limit', POOL_CONFIG.connectionLimit.toString())
    pooledUrl.searchParams.set('pool_timeout', '30')
    pooledUrl.searchParams.set('connect_timeout', '10')
    pooledUrl.searchParams.set('socket_timeout', '30')
    pooledUrl.searchParams.set('statement_cache_size', '0')
    connectionUrl = pooledUrl.toString()
  }

  const client = new PrismaClient({
    log: LOG_CONFIG,
    datasources: {
      db: {
        url: connectionUrl
      }
    },
    errorFormat: isDevelopment ? 'pretty' : 'minimal',
    transactionOptions: {
      // Serverless-optimized timeouts
      maxWait: isVercelServerless ? 20000 : POOL_CONFIG.acquireTimeout, // 20s for serverless vs 60s
      timeout: isVercelServerless ? 30000 : POOL_CONFIG.transactionTimeout, // 30s for serverless vs 60s
      isolationLevel: 'ReadCommitted'
    }
  });

  // Add connection retry logic with exponential backoff
  const originalConnect = client.$connect.bind(client);
  client.$connect = async () => {
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        await originalConnect();
        if (retries > 0) {
          console.log(`✅ Database reconnected after ${retries} retries`);
        }
        return;
      } catch (error) {
        retries++;
        const delay = Math.min(1000 * Math.pow(2, retries), 5000); // Exponential backoff, max 5s
        
        if (retries < maxRetries) {
          console.warn(`⚠️ Database connection attempt ${retries} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`❌ Database connection failed after ${maxRetries} attempts:`, error);
          throw error;
        }
      }
    }
  };

  // Enhanced error handling and query monitoring
  // Note: Event listeners temporarily disabled due to TypeScript compatibility
  // TODO: Implement proper event monitoring after Prisma client type fixes

  // Connection management
  prismaLogger.debug('✅ Optimized Prisma client created with configuration:', {
    connectionLimit: POOL_CONFIG.connectionLimit,
    environment: process.env.NODE_ENV,
    serverless: isVercelServerless,
    vercelEnv: process.env.VERCEL_ENV,
    pooling: 'enabled',
    directConnection: !!directUrl,
    supabase: databaseUrl.includes('supabase.co'),
    preparedStatements: isVercelServerless && databaseUrl.includes('supabase.co') ? 'disabled' : 'enabled'
  })

  return client
}

// Singleton pattern with connection pooling
let prismaPooled: PrismaClient

try {
  // Use global instance if available (for development hot reload)
  if (globalThis.prismaPooled) {
    prismaPooled = globalThis.prismaPooled
    prismaLogger.debug('🔄 Using existing global Prisma pooled client')
  } else {
    prismaPooled = createOptimizedPrismaClient()
    
    // Store in global for development hot reload
    if (isDevelopment && !isBuildTime) {
      globalThis.prismaPooled = prismaPooled
      prismaLogger.debug('💾 Stored Prisma pooled client in global for development')
    }
  }
} catch (error) {
  console.error('❌ Failed to initialize Prisma pooled client:', error)
  
  // In production build, create a mock client for build-time analysis
  if (isBuildTime) {
    prismaLogger.debug('⚠️ Creating mock Prisma pooled client for build-time analysis')
    prismaPooled = createMockPrismaClient()
  } else {
    throw error
  }
}

// Graceful shutdown handling
const handleShutdown = async () => {
  prismaLogger.debug('🔄 Gracefully disconnecting Prisma client...')
  await prismaPooled.$disconnect()
  prismaLogger.debug('✅ Prisma client disconnected')
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
        serverless: isVercelServerless,
        preparedStatementsDisabled: isVercelServerless && (databaseUrl?.includes('supabase.co') ?? false),
        healthy: true
      }
    } catch (error) {
      return {
        activeConnections: 0,
        maxConnections: POOL_CONFIG.maxConnections,
        serverless: isVercelServerless,
        preparedStatementsDisabled: isVercelServerless && (databaseUrl?.includes('supabase.co') ?? false),
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  },

  /**
   * Debug prepared statement issues
   */
  async debugPreparedStatements() {
    try {
      const result = await prismaPooled.$queryRaw<Array<{ name: string; statement: string; from_sql: boolean }>>`
        SELECT name, statement, from_sql FROM pg_prepared_statements LIMIT 10
      `
      console.log('🔍 Current prepared statements:', result)
      return result
    } catch (error) {
      console.warn('⚠️ Could not fetch prepared statements (expected in serverless):', error)
      return []
    }
  }
}

// Export the optimized client
export { prismaPooled }
export default prismaPooled 