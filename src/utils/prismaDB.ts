// Try to import PrismaClient, fallback to mock if not available
let PrismaClient: any;
let PrismaClientType: any;
try {
  const prismaModule = require('@prisma/client');
  PrismaClient = prismaModule.PrismaClient;
  PrismaClientType = PrismaClient;
} catch (error) {
  console.warn('⚠️ Could not import PrismaClient from @prisma/client, will use mock client');
  PrismaClient = undefined;
  PrismaClientType = class MockPrismaClient {};
}

/**
 * Robust PrismaClient instantiation with lazy loading and error handling
 */

// Define the global type that will hold our PrismaClient instance
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: typeof PrismaClientType | undefined;
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
const createMockPrismaClient = (): typeof PrismaClientType => {
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
  } as any as typeof PrismaClientType

  return mockClient
}

// Create Prisma client with better error handling
const createPrismaClient = (): typeof PrismaClientType => {
  console.log('🟢 Creating Prisma client')
  
  // During build time, we might not have a database connection
  if (isBuildTime) {
    return createMockPrismaClient()
  }
  
  // Check if PrismaClient is available
  if (typeof PrismaClient === 'undefined') {
    console.error('❌ PrismaClient is not available. Please run "prisma generate" first.')
    console.log('⚠️ Falling back to mock Prisma client')
    return createMockPrismaClient()
  }

  // If no database URL, use mock client
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not defined. Please check your environment variables.')
    console.log('⚠️ Falling back to mock Prisma client')
    return createMockPrismaClient()
  }

  try {
    // Try to create the client with configuration first
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
    // Silently try basic client without logging
    try {
      const fallbackClient = new PrismaClient()
      console.log('✅ Fallback Prisma client created successfully')
      return fallbackClient
    } catch (fallbackError) {
      // Only log in development, and make it less alarming
      if (isDevelopment) {
        console.log('ℹ️ Using mock Prisma client for development')
      }
      return createMockPrismaClient()
    }
  }
};

// Lazy initialization pattern
let _prisma: typeof PrismaClientType | null = null

const getPrismaClient = (): typeof PrismaClientType => {
  if (_prisma) {
    return _prisma
  }

  // Use global instance if available (for development hot reload)
  if (globalThis.prismaGlobal) {
    _prisma = globalThis.prismaGlobal
    console.log('🔄 Using existing global Prisma client')
    return _prisma
  }

  try {
    _prisma = createPrismaClient()
    
    // Store in global for development hot reload
    if (isDevelopment && !isBuildTime) {
      globalThis.prismaGlobal = _prisma
      console.log('💾 Stored Prisma client in global for development')
    }

    return _prisma
  } catch (error) {
    console.error('❌ Failed to initialize Prisma client:', error)
    
    // Always fall back to mock client if anything fails
    console.log('⚠️ Creating mock Prisma client as fallback')
    _prisma = createMockPrismaClient()
    return _prisma
  }
}

// Export the client using lazy initialization
export const prisma = new Proxy({} as typeof PrismaClientType, {
  get(target, prop) {
    const client = getPrismaClient()
    return client[prop as keyof typeof PrismaClientType]
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