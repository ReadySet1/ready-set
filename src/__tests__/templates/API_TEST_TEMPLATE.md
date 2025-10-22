# API Test Template Guide

## Overview
This template provides standardized patterns for testing API routes in the Ready Set application. Use these patterns to ensure consistent, comprehensive test coverage across all 127 API routes.

## Test File Structure

```typescript
// src/__tests__/api/[domain]/[route-name].test.ts

import { GET, POST, PUT, PATCH, DELETE } from '@/app/api/[path]/route';
import { createClient } from '@/utils/supabase/server';
import {
  createGetRequest,
  createPostRequest,
  createPatchRequest,
  createPutRequest,
  createDeleteRequest,
  expectSuccessResponse,
  expectErrorResponse,
  expectUnauthorized,
  expectValidationError,
  createMockSupabaseAuth,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/lib/db/prisma-pooled'); // If using Prisma

describe('/api/[path] [METHOD] API', () => {
  // Setup mocks
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  // Test suites follow below...
});
```

## Test Suite Categories

### 1. ✅ Success Path Tests

Test the happy path - when everything works correctly.

```typescript
describe('✅ Successful [Operation]', () => {
  it('should return [expected result] when [condition]', async () => {
    // Arrange: Setup mocks and test data
    const mockData = { /* test data */ };
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });

    // Act: Make the request
    const request = createGetRequest('http://localhost:3000/api/endpoint');
    const response = await GET(request);
    const data = await response.json();

    // Assert: Verify results
    expect(response.status).toBe(200);
    expect(data).toMatchObject({ /* expected shape */ });
  });
});
```

### 2. 🔐 Authentication Tests

Test authentication and authorization requirements.

```typescript
describe('🔐 Authentication Tests', () => {
  it('should return 401 for unauthenticated requests', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = createGetRequest('http://localhost:3000/api/endpoint');
    const response = await GET(request);

    await expectUnauthorized(response, 'Not authenticated');
  });

  it('should return 401 for expired JWT tokens', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT token is invalid' },
    });

    const request = createGetRequest('http://localhost:3000/api/endpoint');
    const response = await GET(request);

    await expectUnauthorized(response);
  });

  it('should return 403 for insufficient permissions', async () => {
    // Setup user with wrong role
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', role: 'CLIENT' } },
      error: null,
    });

    const request = createGetRequest('http://localhost:3000/api/admin/endpoint');
    const response = await GET(request);

    expect(response.status).toBe(403);
  });
});
```

### 3. ✏️ Validation Tests

Test input validation and error handling for malformed requests.

```typescript
describe('✏️ Validation Tests', () => {
  it('should return 400 when required field is missing', async () => {
    const invalidBody = { /* missing required field */ };

    const request = createPostRequest('http://localhost:3000/api/endpoint', invalidBody);
    const response = await POST(request);

    await expectValidationError(response, /required/i);
  });

  it('should return 400 for invalid field types', async () => {
    const invalidBody = {
      email: 'not-an-email', // Invalid email format
      age: 'twenty', // Should be number
    };

    const request = createPostRequest('http://localhost:3000/api/endpoint', invalidBody);
    const response = await POST(request);

    await expectValidationError(response);
  });

  it('should validate business rules', async () => {
    const invalidBody = {
      pickupDateTime: '2025-01-01T10:00:00Z',
      arrivalDateTime: '2025-01-01T09:00:00Z', // Before pickup!
    };

    const request = createPostRequest('http://localhost:3000/api/orders', invalidBody);
    const response = await POST(request);

    await expectValidationError(response, /arrival.*after.*pickup/i);
  });
});
```

### 4. 🏢 Multi-Tenant Isolation Tests

Verify that users can only access their own data.

```typescript
describe('🏢 Multi-Tenant Isolation Tests', () => {
  it('should only return data for authenticated user', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock Prisma to verify userId filter
    const mockFindMany = jest.fn().mockResolvedValue([
      { id: '1', userId: 'user-123', data: 'user data' },
    ]);
    (prisma.orders.findMany as jest.Mock) = mockFindMany;

    const request = createGetRequest('http://localhost:3000/api/orders');
    const response = await GET(request);

    // Verify userId filter was applied
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-123',
        }),
      })
    );
  });

  it('should return 403 when accessing another user\'s resource', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // Try to access resource owned by different user
    const request = createGetRequest('http://localhost:3000/api/orders/other-user-order-id');
    const response = await GET(request);

    expect(response.status).toBe(403);
  });
});
```

### 5. 🗑️ Soft Delete Tests

Test that deleted records are properly filtered.

```typescript
describe('🗑️ Soft Delete Tests', () => {
  it('should exclude soft-deleted records', async () => {
    const mockFindMany = jest.fn().mockResolvedValue([
      { id: '1', deletedAt: null, data: 'active' },
      // Soft-deleted record should not be returned
    ]);
    (prisma.orders.findMany as jest.Mock) = mockFindMany;

    const request = createGetRequest('http://localhost:3000/api/orders');
    await GET(request);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
        }),
      })
    );
  });

  it('should return 404 when accessing soft-deleted resource', async () => {
    const mockFindUnique = jest.fn().mockResolvedValue({
      id: 'order-123',
      deletedAt: '2025-01-01T00:00:00Z',
    });
    (prisma.orders.findUnique as jest.Mock) = mockFindUnique;

    const request = createGetRequest('http://localhost:3000/api/orders/order-123');
    const response = await GET(request);

    expect(response.status).toBe(404);
  });
});
```

### 6. 📊 Response Structure Tests

Verify response format and data integrity.

```typescript
describe('📊 Response Structure Tests', () => {
  it('should return properly formatted response', async () => {
    const mockData = { id: '1', name: 'Test' };

    const request = createGetRequest('http://localhost:3000/api/resource');
    const response = await GET(request);
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('createdAt');
    expect(data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO date
  });

  it('should include pagination metadata for list endpoints', async () => {
    const request = createGetRequest('http://localhost:3000/api/orders?page=2&limit=10');
    const response = await GET(request);
    const data = await response.json();

    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('pagination');
    expect(data.pagination).toMatchObject({
      currentPage: 2,
      totalPages: expect.any(Number),
      totalItems: expect.any(Number),
      itemsPerPage: 10,
    });
  });
});
```

### 7. 🔒 Security Tests

Test security measures and sensitive data handling.

```typescript
describe('🔒 Security Tests', () => {
  it('should not expose sensitive database errors', async () => {
    (prisma.orders.findMany as jest.Mock).mockRejectedValue(
      new Error('Internal: Connection string postgres://user:password@host')
    );

    const request = createGetRequest('http://localhost:3000/api/orders');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).not.toContain('postgres');
    expect(data.error).not.toContain('password');
    expect(data.error).toBe('Internal server error'); // Generic message
  });

  it('should not expose user tokens in error responses', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT verification failed: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
    });

    const request = createGetRequest('http://localhost:3000/api/endpoint');
    const response = await GET(request);
    const data = await response.json();

    expect(data.error).not.toContain('eyJhbGci');
  });

  it('should sanitize user input to prevent injection', async () => {
    const maliciousInput = {
      search: "'; DROP TABLE orders; --",
    };

    const request = createPostRequest('http://localhost:3000/api/search', maliciousInput);
    const response = await POST(request);

    // Should handle safely without SQL injection
    expect(response.status).not.toBe(500);
  });
});
```

### 8. ❌ Error Handling Tests

Test various error scenarios.

```typescript
describe('❌ Error Handling Tests', () => {
  it('should handle database connection failures', async () => {
    (prisma.orders.findMany as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    const request = createGetRequest('http://localhost:3000/api/orders');
    const response = await GET(request);

    expect(response.status).toBe(500);
  });

  it('should return 404 for non-existent resources', async () => {
    (prisma.orders.findUnique as jest.Mock).mockResolvedValue(null);

    const request = createGetRequest('http://localhost:3000/api/orders/nonexistent-id');
    const response = await GET(request);

    expect(response.status).toBe(404);
  });

  it('should handle external API failures gracefully', async () => {
    // Mock external API failure (e.g., Stripe, email service)
    mockExternalAPI.call.mockRejectedValue(new Error('Service unavailable'));

    const request = createPostRequest('http://localhost:3000/api/checkout', {});
    const response = await POST(request);

    expect(response.status).toBe(503); // Service Unavailable
    const data = await response.json();
    expect(data.error).toMatch(/temporarily unavailable/i);
  });
});
```

### 9. 🎯 Role-Based Access Control Tests

Test different user roles have appropriate access.

```typescript
describe('🎯 Role-Based Access Control Tests', () => {
  it('should allow ADMIN access to admin endpoints', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-123', role: 'ADMIN' } },
      error: null,
    });

    const request = createGetRequest('http://localhost:3000/api/admin/users');
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it('should deny CLIENT access to admin endpoints', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'client-123', role: 'CLIENT' } },
      error: null,
    });

    const request = createGetRequest('http://localhost:3000/api/admin/users');
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it('should allow DRIVER to update only their own status', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'driver-123', role: 'DRIVER' } },
      error: null,
    });

    // Own status - should succeed
    const request1 = createPatchRequest(
      'http://localhost:3000/api/drivers/driver-123/status',
      { status: 'AVAILABLE' }
    );
    const response1 = await PATCH(request1);
    expect(response1.status).toBe(200);

    // Another driver's status - should fail
    const request2 = createPatchRequest(
      'http://localhost:3000/api/drivers/other-driver-123/status',
      { status: 'AVAILABLE' }
    );
    const response2 = await PATCH(request2);
    expect(response2.status).toBe(403);
  });
});
```

## Quick Start Checklist

When creating tests for a new API route:

- [ ] Create test file in `src/__tests__/api/[domain]/[route-name].test.ts`
- [ ] Import route handlers and test helpers
- [ ] Setup mocks in `beforeEach`
- [ ] Test Success Paths (✅)
- [ ] Test Authentication (🔐)
- [ ] Test Validation (✏️)
- [ ] Test Multi-Tenant Isolation (🏢)
- [ ] Test Soft Deletes (🗑️)
- [ ] Test Response Structure (📊)
- [ ] Test Security (🔒)
- [ ] Test Error Handling (❌)
- [ ] Test RBAC (🎯)
- [ ] Run tests: `pnpm test [test-file]`
- [ ] Verify coverage: `pnpm test:coverage`

## Common Patterns

### Testing with Prisma Mock

```typescript
import { prismaMock } from '@/__tests__/helpers/prisma-mock';

beforeEach(() => {
  jest.clearAllMocks();
});

it('should query database correctly', async () => {
  prismaMock.orders.findMany.mockResolvedValue([
    { id: '1', orderNumber: 'ORD001' },
  ]);

  const response = await GET(request);

  expect(prismaMock.orders.findMany).toHaveBeenCalledWith({
    where: { userId: 'user-123', deletedAt: null },
  });
});
```

### Testing Query Parameters

```typescript
it('should handle query parameters correctly', async () => {
  const request = createRequestWithParams(
    'http://localhost:3000/api/orders',
    { page: '2', limit: '20', status: 'ACTIVE' }
  );

  const response = await GET(request);
  const data = await response.json();

  expect(data.pagination.currentPage).toBe(2);
  expect(data.items).toHaveLength(20);
});
```

### Testing Date Handling

```typescript
it('should handle date filtering correctly', async () => {
  const request = createRequestWithParams(
    'http://localhost:3000/api/orders',
    { startDate: '2025-01-01', endDate: '2025-01-31' }
  );

  await GET(request);

  expect(prismaMock.orders.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        pickupDateTime: {
          gte: new Date('2025-01-01'),
          lte: new Date('2025-01-31'),
        },
      }),
    })
  );
});
```

## Running Tests

```bash
# Run specific test file
pnpm test src/__tests__/api/auth/current-user.test.ts

# Run all API tests
pnpm test src/__tests__/api

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test --watch

# Run single test
pnpm test -t "should return 401 for unauthenticated requests"
```

## Coverage Goals

- **Line Coverage**: ≥ 85%
- **Branch Coverage**: ≥ 80%
- **Function Coverage**: ≥ 85%
- **Statement Coverage**: ≥ 85%

## Next Steps

1. Use this template to create tests for critical routes first (auth, orders, payments)
2. Follow the test suite categories to ensure comprehensive coverage
3. Run tests frequently during development
4. Update this template as new patterns emerge
