# CaterValley Naming Conventions

## Overview

This document establishes consistent naming conventions for all CaterValley-related code throughout the application. Consistent naming improves code readability, maintainability, and reduces confusion when working with this external service integration.

## Background

CaterValley is an external third-party catering service API that our application integrates with. The service name appears throughout our codebase in various contexts: API clients, service layers, route handlers, types, configuration, and user-facing messages.

## Naming Rules

### 1. PascalCase: `CaterValley`

**Use in:**
- Type definitions and interfaces
- Class names
- React component names
- User-facing text and error messages
- JSDoc comments and documentation
- Log messages intended for human consumption
- File names (when representing a class or type)

**Examples:**

```typescript
// ✅ Correct
interface CaterValleyOrder {
  orderId: string;
  status: string;
}

class CaterValleyClient {
  async getOrder(orderId: string): Promise<CaterValleyOrder> { }
}

// Error messages
throw new Error('CaterValley API is unavailable');

// JSDoc
/**
 * Fetches order details from the CaterValley API
 * @param orderId - The CaterValley order identifier
 */

// Logging
console.log('[CaterValley] Order status updated');
```

```typescript
// ❌ Incorrect
interface caterValleyOrder { }  // Should be PascalCase
class catervalleyClient { }     // Should be PascalCase
throw new Error('caterValley API is unavailable'); // Should be PascalCase
```

### 2. camelCase: `caterValley`

**Use in:**
- Variable names
- Function names (except constructors/classes)
- Object property names
- Module exports (when not a class/type)
- Configuration keys
- Environment variable references in code (after parsing)
- Parameter names

**Examples:**

```typescript
// ✅ Correct
const caterValleyApiKey = process.env.CATER_VALLEY_API_KEY;

function fetchCaterValleyOrder(orderId: string) { }

const config = {
  caterValleyTimeout: 30000,
  caterValleyRetryAttempts: 3,
};

// Object properties
const result = {
  caterValleyOrderId: '12345',
  caterValleyStatus: 'confirmed',
};

// Circuit breaker instance
export const caterValleyCircuitBreaker = new CircuitBreaker({
  name: 'CaterValley',  // Display name is PascalCase
  // ...
});
```

```typescript
// ❌ Incorrect
const CaterValleyApiKey = process.env.CATER_VALLEY_API_KEY;  // Should be camelCase
function FetchCaterValleyOrder(orderId: string) { }          // Should be camelCase
const config = {
  CaterValleyTimeout: 30000,  // Should be camelCase
};
```

### 3. SCREAMING_SNAKE_CASE: `CATER_VALLEY`

**Use in:**
- Environment variable names
- Global constants that represent fixed configuration values
- Enum values (TypeScript enums)

**Examples:**

```typescript
// ✅ Correct
// Environment variables
CATER_VALLEY_API_KEY=your-key-here
CATER_VALLEY_BASE_URL=https://api.catervalley.com
CATER_VALLEY_TIMEOUT=30000

// Constants
const CATER_VALLEY_MAX_RETRIES = 3;
const CATER_VALLEY_RATE_LIMIT = 100;

// Enum values
enum ServiceProvider {
  CATER_VALLEY = 'cater_valley',
  OTHER_SERVICE = 'other_service',
}
```

### 4. kebab-case: `cater-valley`

**Use in:**
- URL paths and route segments
- File names (for routes and utilities)
- CSS class names
- Database field names (if using snake_case is not preferred)
- API endpoint paths

**Examples:**

```typescript
// ✅ Correct
// File: src/lib/services/cater-valley-service.ts
// Route: /api/cater-valley/update-order-status
// CSS: .cater-valley-status-badge

// API routes
app.get('/api/cater-valley/orders/:id', handler);
```

### 5. snake_case: `cater_valley`

**Use in:**
- Database table names
- Database column names
- JSON API response field names (if the external API uses this convention)

**Examples:**

```sql
-- ✅ Correct
CREATE TABLE cater_valley_orders (
  id UUID PRIMARY KEY,
  cater_valley_order_id VARCHAR(255),
  cater_valley_status VARCHAR(50)
);
```

## Common Patterns and Examples

### Service Layer

```typescript
// src/lib/services/caterValleyService.ts

import { CaterValleyOrder, CaterValleyOrderStatus } from '@/types/catervalley';

/**
 * CaterValley Service
 *
 * Handles all interactions with the CaterValley API including
 * order creation, status updates, and order retrieval.
 */
export class CaterValleyService {
  private readonly caterValleyApiKey: string;
  private readonly caterValleyBaseUrl: string;

  constructor() {
    this.caterValleyApiKey = process.env.CATER_VALLEY_API_KEY || '';
    this.caterValleyBaseUrl = process.env.CATER_VALLEY_BASE_URL || '';
  }

  /**
   * Fetch an order from CaterValley
   */
  async getCaterValleyOrder(orderId: string): Promise<CaterValleyOrder> {
    // Implementation
  }

  /**
   * Update order status in CaterValley
   */
  async updateCaterValleyOrderStatus(
    orderId: string,
    status: CaterValleyOrderStatus
  ): Promise<void> {
    // Implementation
  }
}

// Export instance with camelCase
export const caterValleyService = new CaterValleyService();
```

### API Routes

```typescript
// src/app/api/cater-valley/update-order-status/route.ts

import { caterValleyService } from '@/lib/services/caterValleyService';
import { CaterValleyOrderStatus } from '@/types/catervalley';

/**
 * POST /api/cater-valley/update-order-status
 *
 * Updates the order status in the CaterValley system
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId, status }: { orderId: string; status: CaterValleyOrderStatus } =
      await request.json();

    await caterValleyService.updateCaterValleyOrderStatus(orderId, status);

    return NextResponse.json({
      message: 'CaterValley order status updated successfully',
      orderId,
    });
  } catch (error) {
    console.error('[CaterValley] Failed to update order status:', error);

    return NextResponse.json(
      {
        error: 'Failed to update CaterValley order status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

### Types and Interfaces

```typescript
// src/types/catervalley.ts

/**
 * CaterValley order status enum
 */
export enum CaterValleyOrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * CaterValley order interface
 */
export interface CaterValleyOrder {
  orderId: string;
  status: CaterValleyOrderStatus;
  customerName: string;
  deliveryAddress: string;
  items: CaterValleyOrderItem[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * CaterValley order item interface
 */
export interface CaterValleyOrderItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
}

/**
 * CaterValley API response wrapper
 */
export interface CaterValleyApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

### Configuration

```typescript
// src/config/catervalley.ts

/**
 * CaterValley API configuration
 */
export const caterValleyConfig = {
  apiKey: process.env.CATER_VALLEY_API_KEY,
  baseUrl: process.env.CATER_VALLEY_BASE_URL,
  timeout: parseInt(process.env.CATER_VALLEY_TIMEOUT || '30000', 10),
  maxRetries: parseInt(process.env.CATER_VALLEY_MAX_RETRIES || '3', 10),
  retryDelay: parseInt(process.env.CATER_VALLEY_RETRY_DELAY || '1000', 10),
};

/**
 * CaterValley circuit breaker configuration
 */
export const CATER_VALLEY_CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
} as const;
```

### Error Handling

```typescript
/**
 * Custom error class for CaterValley API errors
 */
export class CaterValleyApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly caterValleyErrorCode?: string
  ) {
    super(message);
    this.name = 'CaterValleyApiError';
  }
}

// Usage
try {
  await caterValleyService.getCaterValleyOrder(orderId);
} catch (error) {
  if (error instanceof CaterValleyApiError) {
    console.error(`[CaterValley] API Error: ${error.message}`);
    console.error(`[CaterValley] Status Code: ${error.statusCode}`);
    console.error(`[CaterValley] Error Code: ${error.caterValleyErrorCode}`);
  }
}
```

## Migration Guide

If you encounter code that doesn't follow these conventions:

1. **Type/Class Names**: Should be `CaterValley` (PascalCase)
   - Update: `interface CatervalleyOrder` → `interface CaterValleyOrder`
   - Update: `class caterValleyClient` → `class CaterValleyClient`

2. **Variable/Function Names**: Should be `caterValley` (camelCase)
   - Update: `const CaterValleyService` → `const caterValleyService`
   - Update: `function FetchOrder` → `function fetchCaterValleyOrder`

3. **Constants**: Should be `CATER_VALLEY` (SCREAMING_SNAKE_CASE)
   - Update: `const caterValleyMaxRetries` → `const CATER_VALLEY_MAX_RETRIES`

4. **Routes/Files**: Should be `cater-valley` (kebab-case)
   - Update: `/api/caterValley/orders` → `/api/cater-valley/orders`
   - Update: `caterValleyService.ts` → `cater-valley-service.ts` (for utility files)

## Rationale

These conventions were chosen to:

1. **Match industry standards**: PascalCase for types/classes, camelCase for variables/functions
2. **Maintain consistency**: Single source of truth for how to reference CaterValley
3. **Improve readability**: Clear distinction between different code contexts
4. **Reduce cognitive load**: Developers can focus on logic rather than naming decisions
5. **Enable better tooling**: Consistent naming improves IDE autocomplete and search
6. **Prevent bugs**: Reduces typos and naming-related errors (e.g., `catervalley` vs `caterValley`)

## References

- [TypeScript Coding Guidelines](https://github.com/Microsoft/TypeScript/wiki/Coding-guidelines)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)

## Related Files

Key files that implement these conventions:

- `src/lib/services/caterValleyService.ts` - Main service implementation
- `src/utils/api-resilience.ts` - Circuit breaker for CaterValley
- `src/app/api/cater-valley/*` - API route handlers
- `src/types/catervalley.ts` - Type definitions (if exists)

---

**Last Updated**: October 31, 2025
**Maintained By**: Development Team
