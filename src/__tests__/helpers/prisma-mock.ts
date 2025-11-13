import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

/**
 * Type-safe Prisma mock helper using jest-mock-extended
 *
 * This utility provides fully type-safe Prisma mocking for tests,
 * eliminating the need for `(prisma as any)` type assertions.
 *
 * @example
 * ```typescript
 * import { createMockPrisma } from '@/__tests__/helpers/prisma-mock';
 *
 * let prismaMock: ReturnType<typeof createMockPrisma>;
 *
 * beforeEach(() => {
 *   prismaMock = createMockPrisma();
 *   (prisma as any) = prismaMock; // Only type assertion needed
 * });
 *
 * // Now you can use fully type-safe mocking:
 * prismaMock.fileUpload.create.mockResolvedValue({
 *   id: 'upload-123',
 *   fileName: 'test.pdf',
 *   // TypeScript will enforce correct types
 * });
 * ```
 */
export function createMockPrisma(): DeepMockProxy<PrismaClient> {
  return mockDeep<PrismaClient>();
}

/**
 * Type alias for the mock Prisma client
 * Use this type when declaring mock variables
 */
export type MockPrismaClient = DeepMockProxy<PrismaClient>;
