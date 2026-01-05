/**
 * Prisma Mock Helpers
 *
 * This module provides comprehensive Prisma client mocking for tests.
 * It follows the same pattern as the Supabase mock helpers.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type MockPrismaModel = {
  findUnique: jest.Mock;
  findUniqueOrThrow: jest.Mock;
  findFirst: jest.Mock;
  findFirstOrThrow: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  createMany: jest.Mock;
  createManyAndReturn: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
  groupBy: jest.Mock;
};

export type MockPrismaClient = {
  // User/Auth models
  profile: MockPrismaModel;
  userAudit: MockPrismaModel;
  emailPreferences: MockPrismaModel;
  profilePushToken: MockPrismaModel;
  notificationAnalytics: MockPrismaModel;
  notificationDedup: MockPrismaModel;
  account: MockPrismaModel;
  session: MockPrismaModel;

  // Address models
  address: MockPrismaModel;
  userAddress: MockPrismaModel;

  // Order models
  cateringRequest: MockPrismaModel;
  onDemand: MockPrismaModel;
  dispatch: MockPrismaModel;

  // File models
  fileUpload: MockPrismaModel;
  uploadError: MockPrismaModel;

  // Calculator models
  pricingTier: MockPrismaModel;
  calculatorTemplate: MockPrismaModel;
  pricingRule: MockPrismaModel;
  clientConfiguration: MockPrismaModel;
  calculationHistory: MockPrismaModel;
  deliveryConfiguration: MockPrismaModel;

  // Driver/Tracking models
  driver: MockPrismaModel;
  driverLocation: MockPrismaModel;
  driverShift: MockPrismaModel;
  delivery: MockPrismaModel;

  // Misc models
  verificationToken: MockPrismaModel;
  formSubmission: MockPrismaModel;
  leadCapture: MockPrismaModel;
  jobApplication: MockPrismaModel;
  testimonial: MockPrismaModel;

  // Prisma client methods
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
  $queryRawUnsafe: jest.Mock;
  $executeRawUnsafe: jest.Mock;
};

// ============================================================================
// Mock Factory Functions
// ============================================================================

/**
 * Creates a Prisma model mock with all common methods.
 * Methods are jest.fn() without default return values - configure them in your tests.
 * This matches the global mock behavior in jest.setup.ts.
 */
export const createMockPrismaModel = (): MockPrismaModel => ({
  findUnique: jest.fn(),
  findUniqueOrThrow: jest.fn(),
  findFirst: jest.fn(),
  findFirstOrThrow: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  createManyAndReturn: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  groupBy: jest.fn(),
});

/**
 * Creates a Prisma model mock with sensible default return values.
 * Use this when you want mocks that return valid async responses.
 */
export const createMockPrismaModelWithDefaults = (): MockPrismaModel => ({
  findUnique: jest.fn().mockResolvedValue(null),
  findUniqueOrThrow: jest.fn().mockRejectedValue(new Error('Record not found')),
  findFirst: jest.fn().mockResolvedValue(null),
  findFirstOrThrow: jest.fn().mockRejectedValue(new Error('Record not found')),
  findMany: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockImplementation((args) =>
    Promise.resolve({ id: 'mock-id', ...args?.data })
  ),
  createMany: jest.fn().mockResolvedValue({ count: 0 }),
  createManyAndReturn: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockImplementation((args) =>
    Promise.resolve({ id: args?.where?.id || 'mock-id', ...args?.data })
  ),
  updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  upsert: jest.fn().mockImplementation((args) =>
    Promise.resolve({ id: 'mock-id', ...args?.create })
  ),
  delete: jest.fn().mockResolvedValue({ id: 'mock-id' }),
  deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  count: jest.fn().mockResolvedValue(0),
  aggregate: jest.fn().mockResolvedValue({}),
  groupBy: jest.fn().mockResolvedValue([]),
});

/**
 * Creates a complete mock Prisma client with all models from schema.prisma.
 * This is the main factory function used in jest.setup.ts.
 */
export const createMockPrismaClient = (): MockPrismaClient => {
  const mockClient: MockPrismaClient = {
    // User/Auth models
    profile: createMockPrismaModel(),
    userAudit: createMockPrismaModel(),
    emailPreferences: createMockPrismaModel(),
    profilePushToken: createMockPrismaModel(),
    notificationAnalytics: createMockPrismaModel(),
    notificationDedup: createMockPrismaModel(),
    account: createMockPrismaModel(),
    session: createMockPrismaModel(),

    // Address models
    address: createMockPrismaModel(),
    userAddress: createMockPrismaModel(),

    // Order models
    cateringRequest: createMockPrismaModel(),
    onDemand: createMockPrismaModel(),
    dispatch: createMockPrismaModel(),

    // File models
    fileUpload: createMockPrismaModel(),
    uploadError: createMockPrismaModel(),

    // Calculator models
    pricingTier: createMockPrismaModel(),
    calculatorTemplate: createMockPrismaModel(),
    pricingRule: createMockPrismaModel(),
    clientConfiguration: createMockPrismaModel(),
    calculationHistory: createMockPrismaModel(),
    deliveryConfiguration: createMockPrismaModel(),

    // Driver/Tracking models
    driver: createMockPrismaModel(),
    driverLocation: createMockPrismaModel(),
    driverShift: createMockPrismaModel(),
    delivery: createMockPrismaModel(),

    // Misc models
    verificationToken: createMockPrismaModel(),
    formSubmission: createMockPrismaModel(),
    leadCapture: createMockPrismaModel(),
    jobApplication: createMockPrismaModel(),
    testimonial: createMockPrismaModel(),

    // Prisma client methods
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn().mockImplementation(async (fnOrArray) => {
      if (typeof fnOrArray === 'function') {
        // Interactive transaction - pass the mock client to the callback
        return fnOrArray(mockClient);
      }
      // Batch transaction - resolve all promises
      return Promise.all(fnOrArray);
    }),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
  };

  return mockClient;
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Resets all mock functions on a Prisma client.
 * Use this in beforeEach() to ensure clean state between tests.
 */
export const resetPrismaMocks = (prisma: MockPrismaClient): void => {
  Object.entries(prisma).forEach(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      // It's a model - reset all its methods
      Object.values(value).forEach((method) => {
        if (typeof method === 'function' && 'mockClear' in method) {
          (method as jest.Mock).mockClear();
        }
      });
    } else if (typeof value === 'function' && 'mockClear' in value) {
      // It's a client method like $transaction
      (value as jest.Mock).mockClear();
    }
  });
};

/**
 * Helper to configure a model mock with specific return values.
 * @example
 * configureMockModel(mockPrisma.profile, {
 *   findUnique: { id: 'user-1', name: 'Test User' },
 *   findMany: [{ id: 'user-1' }, { id: 'user-2' }],
 * });
 */
export const configureMockModel = (
  model: MockPrismaModel,
  config: Partial<Record<keyof MockPrismaModel, any>>
): void => {
  Object.entries(config).forEach(([method, returnValue]) => {
    const mockMethod = model[method as keyof MockPrismaModel];
    if (mockMethod && typeof mockMethod.mockResolvedValue === 'function') {
      mockMethod.mockResolvedValue(returnValue);
    }
  });
};

/**
 * Creates a mock Prisma error for testing error handling.
 */
export class MockPrismaError extends Error {
  code: string;
  meta?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    meta?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
    this.meta = meta;
  }
}

/**
 * Common Prisma error codes for testing.
 */
export const PrismaErrorCodes = {
  UNIQUE_CONSTRAINT: 'P2002',
  FOREIGN_KEY_CONSTRAINT: 'P2003',
  RECORD_NOT_FOUND: 'P2025',
  REQUIRED_RELATION_VIOLATION: 'P2014',
  QUERY_INTERPRETATION_ERROR: 'P2016',
} as const;

// ============================================================================
// Shared Mock Instance
// ============================================================================

/**
 * Shared mock Prisma client instance.
 * This is used by jest.setup.ts for consistent mocking across all tests.
 */
export const mockPrismaClient = createMockPrismaClient();
