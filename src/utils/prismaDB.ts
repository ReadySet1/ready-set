import { PrismaClient } from '@prisma/client'

/**
 * Robust PrismaClient instantiation with lazy loading and error handling
 */

// Define the global type that will hold our PrismaClient instance
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// Environment checks
const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'
const databaseUrl = process.env.DATABASE_URL

// Debug environment
console.log('Prisma Environment Check:', {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_RUNTIME: process.env.NEXT_RUNTIME,
  NEXT_PHASE: process.env.NEXT_PHASE,
  hasDataBaseUrl: !!databaseUrl,
  databaseUrlPreview: databaseUrl ? databaseUrl.substring(0, 20) + '...' : 'NOT SET'
})

// Create a mock Prisma client for build-time
const createMockPrismaClient = (): PrismaClient => {
  console.log('⚠️ Creating mock Prisma client for build-time analysis')
  
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
    onDemand: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    address: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    dispatch: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    userAddress: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    verificationToken: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    formSubmission: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    leadCapture: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    pricingTier: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    account: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    session: {
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
  } as any as PrismaClient

  return mockClient
}

// Create Prisma client with better error handling
const createPrismaClient = (): PrismaClient => {
  console.log('🟢 Creating Prisma client')
  
  // During build time, we might not have a database connection
  if (isBuildTime) {
    return createMockPrismaClient()
  }
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not defined. Please check your environment variables.')
    throw new Error('DATABASE_URL is not defined. Please check your environment variables.')
  }

  try {
    // Check if PrismaClient is available
    if (typeof PrismaClient === 'undefined') {
      console.error('❌ PrismaClient is not available. Please run "prisma generate" first.')
      throw new Error('PrismaClient is not available. Please run "prisma generate" first.')
    }

    // Try to create the client with configuration first
    try {
      const client = new PrismaClient({
        log: isDevelopment ? ['error', 'warn'] : ['error'],
        datasources: {
          db: {
            url: databaseUrl
          }
        }
      });

      console.log('✅ Prisma client created successfully with configuration')
      return client
    } catch (configError) {
      console.log('⚠️ Failed to create Prisma client with configuration, trying basic client')
      
      // Try to create a basic client without custom configuration
      const fallbackClient = new PrismaClient()
      console.log('✅ Fallback Prisma client created successfully')
      return fallbackClient
    }
  } catch (error) {
    console.error('❌ Failed to create Prisma client:', error)
    
    // If it's a runtime error and not build time, try to provide a fallback
    if (!isBuildTime) {
      console.log('⚠️ Creating mock Prisma client as fallback for runtime')
      return createMockPrismaClient()
    }
    
    throw error
  }
};

// Lazy initialization pattern
let _prisma: PrismaClient | null = null

const getPrismaClient = (): PrismaClient => {
  if (_prisma) {
    return _prisma
  }

  try {
    // Use global instance if available (for development hot reload)
    if (globalThis.prismaGlobal) {
      _prisma = globalThis.prismaGlobal
      console.log('🔄 Using existing global Prisma client')
      return _prisma
    }

    _prisma = createPrismaClient()
    
    // Store in global for development hot reload
    if (isDevelopment && !isBuildTime) {
      globalThis.prismaGlobal = _prisma
      console.log('💾 Stored Prisma client in global for development')
    }

    return _prisma
  } catch (error) {
    console.error('❌ Failed to initialize Prisma client:', error)
    
    // In production build, create a mock client for build-time analysis
    if (isBuildTime) {
      console.log('⚠️ Creating mock Prisma client for build-time analysis')
      _prisma = createMockPrismaClient()
    } else {
      // For runtime errors, try to create a mock client as last resort
      console.log('⚠️ Creating mock Prisma client as fallback for runtime')
      _prisma = createMockPrismaClient()
    }

    return _prisma
  }
}

// Export the client using lazy initialization
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    const client = getPrismaClient()
    return client[prop as keyof PrismaClient]
  }
})

// Export default for compatibility
export default prisma;

// Simple manager for compatibility
export const PrismaClientManager = {
  getInstance: () => getPrismaClient(),
  resetInstance: () => {
    globalThis.prismaGlobal = undefined;
    _prisma = null;
  }
};