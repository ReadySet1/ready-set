/**
 * Supabase Mock Helpers
 *
 * Provides properly structured Supabase client mocks for testing.
 * These helpers ensure query builder chains work correctly and prevent
 * destructuring errors.
 *
 * Usage:
 * ```typescript
 * import { createMockSupabaseClient, createMockQueryBuilder } from '@/__tests__/helpers/supabase-mock-helpers';
 *
 * const mockClient = createMockSupabaseClient();
 * (createClient as jest.Mock).mockResolvedValue(mockClient);
 *
 * // Configure responses
 * mockClient.auth.getUser.mockResolvedValue({
 *   data: { user: { id: '123', email: 'test@example.com' } },
 *   error: null
 * });
 *
 * mockClient.from('profiles').select.mockReturnValue(mockClient.from('profiles'));
 * mockClient.from('profiles').single.mockResolvedValue({
 *   data: { id: '123', type: 'ADMIN' },
 *   error: null
 * });
 * ```
 */

export interface MockQueryBuilder {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  upsert: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  gt: jest.Mock;
  gte: jest.Mock;
  lt: jest.Mock;
  lte: jest.Mock;
  like: jest.Mock;
  ilike: jest.Mock;
  is: jest.Mock;
  in: jest.Mock;
  contains: jest.Mock;
  containedBy: jest.Mock;
  range: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  offset: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
  then: jest.Mock;
}

export interface MockSupabaseClient {
  from: jest.Mock;
  auth: {
    getUser: jest.Mock;
    getSession: jest.Mock;
    signInWithPassword: jest.Mock;
    signOut: jest.Mock;
    signUp: jest.Mock;
    refreshSession: jest.Mock;
    updateUser: jest.Mock;
    onAuthStateChange: jest.Mock;
  };
  storage: {
    from: jest.Mock;
  };
  rpc: jest.Mock;
  schema: jest.Mock;
}

/**
 * Creates a mock query builder with all methods properly chained.
 * Each method returns the same builder instance to support chaining.
 * The single() and maybeSingle() methods return promises with {data, error} structure.
 */
export function createMockQueryBuilder(): MockQueryBuilder {
  const mockBuilder: any = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    eq: jest.fn(),
    neq: jest.fn(),
    gt: jest.fn(),
    gte: jest.fn(),
    lt: jest.fn(),
    lte: jest.fn(),
    like: jest.fn(),
    ilike: jest.fn(),
    is: jest.fn(),
    in: jest.fn(),
    contains: jest.fn(),
    containedBy: jest.fn(),
    range: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn((resolve) => resolve({ data: null, error: null })),
  };

  // Make all chainable methods return the builder itself
  mockBuilder.select.mockReturnValue(mockBuilder);
  mockBuilder.insert.mockReturnValue(mockBuilder);
  mockBuilder.update.mockReturnValue(mockBuilder);
  mockBuilder.delete.mockReturnValue(mockBuilder);
  mockBuilder.upsert.mockReturnValue(mockBuilder);
  mockBuilder.eq.mockReturnValue(mockBuilder);
  mockBuilder.neq.mockReturnValue(mockBuilder);
  mockBuilder.gt.mockReturnValue(mockBuilder);
  mockBuilder.gte.mockReturnValue(mockBuilder);
  mockBuilder.lt.mockReturnValue(mockBuilder);
  mockBuilder.lte.mockReturnValue(mockBuilder);
  mockBuilder.like.mockReturnValue(mockBuilder);
  mockBuilder.ilike.mockReturnValue(mockBuilder);
  mockBuilder.is.mockReturnValue(mockBuilder);
  mockBuilder.in.mockReturnValue(mockBuilder);
  mockBuilder.contains.mockReturnValue(mockBuilder);
  mockBuilder.containedBy.mockReturnValue(mockBuilder);
  mockBuilder.range.mockReturnValue(mockBuilder);
  mockBuilder.order.mockReturnValue(mockBuilder);
  mockBuilder.limit.mockReturnValue(mockBuilder);
  mockBuilder.offset.mockReturnValue(mockBuilder);

  return mockBuilder;
}

/**
 * Creates a mock Supabase client with proper structure.
 *
 * IMPORTANT: The from() method returns THE SAME query builder instance each time.
 * This allows tests to configure the builder once and have it work for all queries.
 *
 * Example:
 * ```typescript
 * const mockClient = createMockSupabaseClient();
 *
 * // This configures the builder that will be returned by ANY from() call
 * mockClient.from('any-table').single.mockResolvedValue({
 *   data: { id: '123' },
 *   error: null
 * });
 *
 * // Now when code calls from('profiles'), it gets the same configured builder
 * const result = await mockClient.from('profiles').select('*').single();
 * // result = { data: { id: '123' }, error: null }
 * ```
 */
export function createMockSupabaseClient(): MockSupabaseClient {
  // Create a single query builder instance that will be reused
  const queryBuilder = createMockQueryBuilder();

  const mockClient: MockSupabaseClient = {
    // CRITICAL: Return the SAME query builder instance every time
    // This allows tests to configure it once and have it work for all queries
    from: jest.fn(() => queryBuilder),

    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: null, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      signUp: jest.fn().mockResolvedValue({ data: null, error: null }),
      refreshSession: jest.fn().mockResolvedValue({ data: null, error: null }),
      updateUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      }),
    },

    storage: {
      from: jest.fn((bucket: string) => ({
        upload: jest.fn().mockResolvedValue({ data: null, error: null }),
        download: jest.fn().mockResolvedValue({ data: null, error: null }),
        remove: jest.fn().mockResolvedValue({ data: null, error: null }),
        list: jest.fn().mockResolvedValue({ data: [], error: null }),
        getPublicUrl: jest.fn((path: string) => ({
          data: { publicUrl: `https://example.com/${path}` }
        })),
      })),
    },

    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    schema: jest.fn().mockReturnThis(),
  };

  return mockClient;
}

/**
 * Helper to create a mock Supabase client configured for a specific user.
 *
 * @param userId - User ID
 * @param userEmail - User email
 * @param userType - User type/role (ADMIN, CLIENT, DRIVER, etc.)
 * @returns Configured mock Supabase client
 */
export function createMockSupabaseClientWithUser(
  userId: string,
  userEmail: string,
  userType: string
): MockSupabaseClient {
  const mockClient = createMockSupabaseClient();

  // Configure auth to return the user
  mockClient.auth.getUser.mockResolvedValue({
    data: { user: { id: userId, email: userEmail } },
    error: null,
  });

  // Configure profile query to return the user type
  mockClient.from('profiles').single.mockResolvedValue({
    data: { id: userId, type: userType },
    error: null,
  });

  return mockClient;
}

/**
 * Helper to create a mock Supabase client configured for unauthenticated state.
 *
 * @returns Configured mock Supabase client with no user
 */
export function createMockSupabaseClientUnauthenticated(): MockSupabaseClient {
  const mockClient = createMockSupabaseClient();

  mockClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  });

  return mockClient;
}
