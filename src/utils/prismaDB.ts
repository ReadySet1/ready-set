// Load environment variables first
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Try to import PrismaClient, fallback to mock if not available
let PrismaClient: any;
let PrismaClientType: any;

// Import PrismaClient with proper error handling - use direct import
try {
  const { PrismaClient: PrismaClientClass } = require('../../node_modules/.prisma/client');
  PrismaClient = PrismaClientClass;
  PrismaClientType = PrismaClientClass;
  console.log('✅ PrismaClient imported successfully via direct path');
} catch (error) {
  console.warn('⚠️ Could not import PrismaClient via direct path, trying standard import...');
  try {
    const { PrismaClient: PrismaClientClass } = require('@prisma/client');
    PrismaClient = PrismaClientClass;
    PrismaClientType = PrismaClientClass;
    console.log('✅ PrismaClient imported successfully via standard import');
  } catch (standardError) {
    console.warn('⚠️ Could not import PrismaClient from @prisma/client, will use mock client');
    console.warn('Error details:', standardError);
    PrismaClient = undefined;
    PrismaClientType = class MockPrismaClient {};
  }
}

/**
 * Robust PrismaClient instantiation with lazy loading and error handling
 */

// Define the global type that will hold our PrismaClient instance
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: typeof PrismaClientType | undefined;
}

// Environment checks - now after dotenv is loaded
const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'
const databaseUrl = process.env.DATABASE_URL

// Debug environment
console.log('Prisma Environment Check:', {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_RUNTIME: process.env.NEXT_RUNTIME,
  NEXT_PHASE: process.env.NEXT_PHASE,
  hasDataBaseUrl: !!databaseUrl,
  databaseUrlPreview: databaseUrl ? databaseUrl.substring(0, 20) + '...' : 'NOT SET',
  prismaClientAvailable: !!PrismaClient,
  isTest: isTest
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
      aggregate: async () => ({ _sum: {} }),
    },
    order: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      aggregate: async () => ({ _sum: {} }),
    },
    cateringRequest: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      aggregate: async () => ({ _sum: { orderTotal: 0 } }),
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
  console.log('🔍 Debug info:', {
    prismaClientType: typeof PrismaClient,
    prismaClientAvailable: !!PrismaClient,
    databaseUrlExists: !!databaseUrl,
    databaseUrlPreview: databaseUrl ? databaseUrl.substring(0, 30) + '...' : 'NOT SET',
    isTest: isTest
  })
  
  // In test environment, always use mock client
  if (isTest) {
    console.log('🧪 Test environment detected - using mock Prisma client');
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
    console.log('🔄 Attempting to create Prisma client with configuration...')
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
    console.error('❌ Error creating Prisma client with configuration:', configError)
    // Silently try basic client without logging
    try {
      console.log('🔄 Attempting to create fallback Prisma client...')
      const fallbackClient = new PrismaClient()
      console.log('✅ Fallback Prisma client created successfully')
      return fallbackClient
    } catch (fallbackError) {
      console.error('❌ Error creating fallback Prisma client:', fallbackError)
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