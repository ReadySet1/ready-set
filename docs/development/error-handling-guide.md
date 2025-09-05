# Error Handling Guide for User Deletion System

## Overview

This guide provides comprehensive information about error handling strategies, patterns, and best practices implemented in the user deletion system.

## Error Classification

### 1. Client Errors (4xx)

#### 400 Bad Request

**Causes**: Invalid input, malformed requests, validation failures

```typescript
// Invalid UUID format
if (!uuidRegex.test(userId)) {
  return NextResponse.json(
    {
      error: "Invalid user ID format",
      code: "INVALID_USER_ID",
      details: "User ID must be a valid UUID",
    },
    { status: 400 },
  );
}

// Missing required parameters
if (!userId) {
  return NextResponse.json(
    {
      error: "User ID is required",
      code: "MISSING_USER_ID",
      details: "User ID must be provided in the URL path",
    },
    { status: 400 },
  );
}
```

#### 401 Unauthorized

**Causes**: Missing or invalid authentication

```typescript
// No authentication token
if (!user) {
  return NextResponse.json(
    {
      error: "Authentication required",
      code: "AUTHENTICATION_REQUIRED",
      details: "Valid authentication token must be provided",
    },
    { status: 401 },
  );
}

// Invalid or expired token
if (authError) {
  return NextResponse.json(
    {
      error: "Invalid authentication token",
      code: "INVALID_TOKEN",
      details: "Authentication token is invalid or expired",
    },
    { status: 401 },
  );
}
```

#### 403 Forbidden

**Causes**: Insufficient permissions, business rule violations

```typescript
// Insufficient role permissions
if (
  !requesterProfile ||
  !["ADMIN", "SUPER_ADMIN"].includes(requesterProfile.type)
) {
  return NextResponse.json(
    {
      error: "Insufficient permissions",
      code: "INSUFFICIENT_PERMISSIONS",
      details: "Only ADMIN or SUPER_ADMIN users can delete other users",
    },
    { status: 403 },
  );
}

// Self-deletion attempt
if (user.id === userId) {
  return NextResponse.json(
    {
      error: "Self-deletion is not allowed",
      code: "SELF_DELETION_FORBIDDEN",
      details:
        "Users cannot delete their own accounts. Please contact an administrator.",
    },
    { status: 403 },
  );
}

// SUPER_ADMIN protection
if (userToDelete.type === "SUPER_ADMIN") {
  return NextResponse.json(
    {
      error: "SUPER_ADMIN users cannot be deleted",
      code: "SUPER_ADMIN_PROTECTED",
      details:
        "SUPER_ADMIN users are protected from deletion for security reasons",
    },
    { status: 403 },
  );
}
```

#### 404 Not Found

**Causes**: Resource does not exist

```typescript
// User not found
if (!userToDelete) {
  return NextResponse.json(
    {
      error: "User not found",
      code: "USER_NOT_FOUND",
      details: "The specified user does not exist or has already been deleted",
    },
    { status: 404 },
  );
}
```

#### 408 Request Timeout

**Causes**: Operation exceeded time limits

```typescript
// Transaction timeout detection
if (
  error.message?.includes("timeout") ||
  error.message?.includes("timed out")
) {
  return NextResponse.json(
    {
      error: "Deletion operation timed out",
      code: "TRANSACTION_TIMEOUT",
      details:
        "The deletion operation exceeded the maximum allowed time limit of 10 seconds",
    },
    { status: 408 },
  );
}
```

#### 409 Conflict

**Causes**: Business logic conflicts, data conflicts

```typescript
// Active orders prevention
if (activeCateringOrders > 0 || activeOnDemandOrders > 0) {
  return NextResponse.json(
    {
      error: "Cannot delete user with active orders",
      code: "ACTIVE_ORDERS_EXIST",
      details: `User has ${activeCateringOrders} active catering orders and ${activeOnDemandOrders} active on-demand orders. Complete or cancel these orders before deletion.`,
      activeOrders: {
        cateringOrders: activeCateringOrders,
        onDemandOrders: activeOnDemandOrders,
      },
    },
    { status: 409 },
  );
}
```

### 2. Server Errors (5xx)

#### 500 Internal Server Error

**Causes**: Database errors, constraint violations, unexpected errors

```typescript
// Prisma constraint violation
if (
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2003"
) {
  return NextResponse.json(
    {
      error: "Database constraint violation",
      code: "CONSTRAINT_VIOLATION",
      details: "Foreign key constraint violation prevented deletion",
    },
    { status: 500 },
  );
}

// Unique constraint violation
if (
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002"
) {
  return NextResponse.json(
    {
      error: "Unique constraint violation",
      code: "UNIQUE_CONSTRAINT_VIOLATION",
      details: "A unique constraint was violated during the deletion process",
    },
    { status: 500 },
  );
}

// Unexpected database error
return NextResponse.json(
  {
    error: "Database operation failed",
    code: "DATABASE_ERROR",
    details: "An unexpected database error occurred during deletion",
  },
  { status: 500 },
);
```

#### 503 Service Unavailable

**Causes**: Database connection issues, service unavailability

```typescript
// Database connection errors
if (
  error instanceof Prisma.PrismaClientKnownRequestError &&
  ["P1001", "P2024"].includes(error.code)
) {
  return NextResponse.json(
    {
      error: "Database connection failed",
      code: "DATABASE_CONNECTION_ERROR",
      details: "Unable to establish database connection",
    },
    { status: 503 },
  );
}
```

## Error Response Structure

### Standard Error Format

```typescript
interface ErrorResponse {
  error: string; // Human-readable error message
  code?: string; // Machine-readable error code
  details?: string; // Additional error details
  timestamp?: string; // ISO timestamp of error
  requestId?: string; // Unique request identifier
  [key: string]: any; // Additional context-specific fields
}
```

### Error Response Examples

#### Client Error Example

```json
{
  "error": "Cannot delete user with active orders",
  "code": "ACTIVE_ORDERS_EXIST",
  "details": "User has 2 active catering orders and 1 active on-demand orders. Complete or cancel these orders before deletion.",
  "activeOrders": {
    "cateringOrders": 2,
    "onDemandOrders": 1
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req_123456789"
}
```

#### Server Error Example

```json
{
  "error": "Database constraint violation",
  "code": "CONSTRAINT_VIOLATION",
  "details": "Foreign key constraint violation prevented deletion",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req_123456789"
}
```

## Error Handling Patterns

### 1. Centralized Error Handler

```typescript
interface ErrorContext {
  userId?: string;
  performedBy?: string;
  operation: string;
  timestamp: Date;
  request: NextRequest;
}

class DeletionErrorHandler {
  static createErrorResponse(
    error: unknown,
    context: ErrorContext,
  ): NextResponse {
    const startTime = Date.now();

    // Log error for monitoring
    this.logError(error, context);

    // Generate audit trail
    this.auditError(error, context);

    // Return appropriate response
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(error, context);
    }

    if (error instanceof ValidationError) {
      return this.handleValidationError(error, context);
    }

    if (error instanceof BusinessLogicError) {
      return this.handleBusinessLogicError(error, context);
    }

    return this.handleUnknownError(error, context);
  }

  private static handlePrismaError(
    error: Prisma.PrismaClientKnownRequestError,
    context: ErrorContext,
  ): NextResponse {
    const errorMap: Record<
      string,
      { status: number; code: string; message: string }
    > = {
      P2025: {
        status: 404,
        code: "USER_NOT_FOUND",
        message: "User not found or already deleted",
      },
      P2003: {
        status: 500,
        code: "CONSTRAINT_VIOLATION",
        message: "Database constraint violation",
      },
      P2002: {
        status: 409,
        code: "UNIQUE_CONSTRAINT_VIOLATION",
        message: "Unique constraint violation",
      },
      P1001: {
        status: 503,
        code: "DATABASE_CONNECTION_ERROR",
        message: "Database connection failed",
      },
      P2024: {
        status: 503,
        code: "DATABASE_CONNECTION_ERROR",
        message: "Database connection failed",
      },
    };

    const errorInfo = errorMap[error.code] || {
      status: 500,
      code: "DATABASE_ERROR",
      message: "An unexpected database error occurred",
    };

    return NextResponse.json(
      {
        error: errorInfo.message,
        code: errorInfo.code,
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: errorInfo.status },
    );
  }
}
```

### 2. Custom Error Classes

```typescript
// Base error class
abstract class DeletionError extends Error {
  abstract code: string;
  abstract statusCode: number;

  constructor(
    message: string,
    public details?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Validation errors
class ValidationError extends DeletionError {
  code = "VALIDATION_ERROR";
  statusCode = 400;
}

// Business logic errors
class BusinessLogicError extends DeletionError {
  code = "BUSINESS_LOGIC_ERROR";
  statusCode = 409;
}

class ActiveOrdersError extends BusinessLogicError {
  code = "ACTIVE_ORDERS_EXIST";

  constructor(cateringOrders: number, onDemandOrders: number) {
    super(
      "Cannot delete user with active orders",
      `User has ${cateringOrders} active catering orders and ${onDemandOrders} active on-demand orders`,
    );
  }
}

class SelfDeletionError extends BusinessLogicError {
  code = "SELF_DELETION_FORBIDDEN";
  statusCode = 403;

  constructor() {
    super(
      "Self-deletion is not allowed",
      "Users cannot delete their own accounts. Please contact an administrator.",
    );
  }
}

class SuperAdminProtectionError extends BusinessLogicError {
  code = "SUPER_ADMIN_PROTECTED";
  statusCode = 403;

  constructor() {
    super(
      "SUPER_ADMIN users cannot be deleted",
      "SUPER_ADMIN users are protected from deletion for security reasons",
    );
  }
}
```

### 3. Error Recovery Strategies

```typescript
class ErrorRecovery {
  static async handleTransactionTimeout(
    operation: () => Promise<any>,
    maxRetries: number = 3,
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (this.isTimeoutError(error) && attempt < maxRetries) {
          console.log(`[RETRY] Attempt ${attempt} failed, retrying...`);
          await this.delay(1000 * attempt); // Exponential backoff
          continue;
        }
        throw error;
      }
    }
  }

  static async handleDatabaseConnection(
    operation: () => Promise<any>,
  ): Promise<any> {
    try {
      return await operation();
    } catch (error) {
      if (this.isConnectionError(error)) {
        // Attempt to reconnect
        await prisma.$disconnect();
        await new Promise((resolve) => setTimeout(resolve, 1000));

        return await operation();
      }
      throw error;
    }
  }

  private static isTimeoutError(error: any): boolean {
    return (
      error.message?.includes("timeout") || error.message?.includes("timed out")
    );
  }

  private static isConnectionError(error: any): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P1001", "P2024"].includes(error.code)
    );
  }

  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

## Audit Trail for Errors

### Error Logging Strategy

```typescript
interface ErrorAuditEntry {
  action: string;
  performedBy: string;
  performedByType: string;
  targetUserId: string;
  targetUserEmail?: string;
  targetUserType?: string;
  error: string;
  errorCode?: string;
  errorDetails?: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  success: false;
  duration?: string;
  stackTrace?: string;
  requestId?: string;
}

function logErrorAudit(
  error: unknown,
  context: {
    user?: any;
    requesterProfile?: any;
    userId?: string;
    userToDelete?: any;
    startTime: number;
    request: NextRequest;
  },
): void {
  const auditEntry: ErrorAuditEntry = {
    action: "USER_DELETION_FAILED",
    performedBy: context.user?.id || "unknown",
    performedByType: context.requesterProfile?.type || "unknown",
    targetUserId: context.userId || "unknown",
    targetUserEmail: context.userToDelete?.email || "unknown",
    targetUserType: context.userToDelete?.type || "unknown",
    error: error instanceof Error ? error.message : String(error),
    errorCode: (error as any)?.code || "UNKNOWN_ERROR",
    errorDetails: (error as any)?.details || undefined,
    timestamp: new Date().toISOString(),
    ipAddress: context.request.headers.get("x-forwarded-for") || "unknown",
    userAgent: context.request.headers.get("user-agent") || "unknown",
    success: false,
    duration: `${Date.now() - context.startTime}ms`,
    stackTrace: error instanceof Error ? error.stack : undefined,
    requestId: generateRequestId(),
  };

  console.log("[AUDIT] User deletion failed:", JSON.stringify(auditEntry));

  // Send to external logging service
  // await sendToLoggingService(auditEntry);
}
```

### Error Monitoring Integration

```typescript
interface ErrorMetrics {
  errorType: string;
  errorCode: string;
  endpoint: string;
  statusCode: number;
  duration: number;
  timestamp: string;
  userId?: string;
  userType?: string;
}

function reportErrorMetrics(
  error: unknown,
  context: ErrorContext,
  statusCode: number,
  duration: number,
): void {
  const metrics: ErrorMetrics = {
    errorType: error.constructor.name,
    errorCode: (error as any)?.code || "UNKNOWN",
    endpoint: "/api/users/[userId]",
    statusCode,
    duration,
    timestamp: new Date().toISOString(),
    userId: context.userId,
    userType: context.userToDelete?.type,
  };

  // Send to monitoring service
  // await sendMetrics('user_deletion_error', metrics);
}
```

## Error Prevention Strategies

### 1. Input Validation

```typescript
// UUID validation
const validateUserId = (userId: string): void => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!userId) {
    throw new ValidationError(
      "User ID is required",
      "User ID must be provided in the URL path",
    );
  }

  if (!uuidRegex.test(userId)) {
    throw new ValidationError(
      "Invalid user ID format",
      "User ID must be a valid UUID",
    );
  }
};

// Authorization validation
const validateAuthorization = (
  user: any,
  requesterProfile: any,
  targetUserId: string,
  targetUserType: string,
): void => {
  if (!user) {
    throw new AuthenticationError("Authentication required");
  }

  if (
    !requesterProfile ||
    !["ADMIN", "SUPER_ADMIN"].includes(requesterProfile.type)
  ) {
    throw new AuthorizationError("Insufficient permissions");
  }

  if (user.id === targetUserId) {
    throw new SelfDeletionError();
  }

  if (targetUserType === "SUPER_ADMIN") {
    throw new SuperAdminProtectionError();
  }
};
```

### 2. Pre-flight Checks

```typescript
const performPreflightChecks = async (userId: string): Promise<void> => {
  // Check for active orders
  const [activeCateringOrders, activeOnDemandOrders] = await Promise.all([
    prisma.cateringRequest.count({
      where: {
        userId,
        status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
      },
    }),
    prisma.onDemand.count({
      where: {
        userId,
        status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
      },
    }),
  ]);

  if (activeCateringOrders > 0 || activeOnDemandOrders > 0) {
    throw new ActiveOrdersError(activeCateringOrders, activeOnDemandOrders);
  }

  // Check for critical dependencies
  const criticalDependencies = await prisma.someTable.count({
    where: { userId, critical: true },
  });

  if (criticalDependencies > 0) {
    throw new BusinessLogicError(
      "Cannot delete user with critical dependencies",
      `User has ${criticalDependencies} critical dependencies that must be resolved first`,
    );
  }
};
```

### 3. Transaction Safety

```typescript
const executeWithSafety = async <T>(
  operation: (tx: PrismaTransaction) => Promise<T>,
  options: {
    timeout?: number;
    retries?: number;
    isolation?: Prisma.TransactionIsolationLevel;
  } = {},
): Promise<T> => {
  const { timeout = 10000, retries = 3, isolation = "ReadCommitted" } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        timeout,
        isolationLevel: isolation,
      });
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      if (isRetryableError(error)) {
        console.log(
          `[RETRY] Transaction attempt ${attempt} failed, retrying...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      throw error;
    }
  }

  throw new Error("Max retries exceeded");
};

const isRetryableError = (error: any): boolean => {
  return (
    error.message?.includes("timeout") ||
    error.message?.includes("connection") ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P1001", "P2024"].includes(error.code))
  );
};
```

## Testing Error Scenarios

### 1. Unit Test Examples

```typescript
describe("Error Handling", () => {
  test("should return 400 for invalid UUID", async () => {
    const req = createRequest("invalid-uuid");
    const res = await DELETE(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_USER_ID");
  });

  test("should return 409 for active orders", async () => {
    mockAuthenticatedUser("admin-id", UserType.ADMIN);
    mockTargetUser("target-id", UserType.VENDOR);
    mockActiveOrders(2, 1); // 2 catering, 1 on-demand

    const req = createRequest("target-id");
    const res = await DELETE(req);

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe("ACTIVE_ORDERS_EXIST");
    expect(data.activeOrders.cateringOrders).toBe(2);
  });

  test("should handle Prisma P2025 error", async () => {
    mockAuthenticatedUser("admin-id", UserType.ADMIN);
    mockTargetUser("target-id", UserType.VENDOR);

    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Record not found",
      { code: "P2025", clientVersion: "4.0.0" },
    );

    (prisma.$transaction as jest.Mock).mockRejectedValue(prismaError);

    const req = createRequest("target-id");
    const res = await DELETE(req);

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe("USER_NOT_FOUND");
  });
});
```

### 2. Integration Test Examples

```typescript
describe("Error Integration Tests", () => {
  test("should handle complete error flow with audit logging", async () => {
    const consoleSpy = jest.spyOn(console, "log");

    // Setup error scenario
    mockAuthenticatedUser("admin-id", UserType.ADMIN);
    mockTargetUser("target-id", UserType.VENDOR);
    mockDatabaseError();

    const req = createRequest("target-id");
    await DELETE(req);

    // Verify audit log was created
    expect(consoleSpy).toHaveBeenCalledWith(
      "[AUDIT] User deletion failed:",
      expect.stringContaining('"action":"USER_DELETION_FAILED"'),
    );

    consoleSpy.mockRestore();
  });
});
```

## Best Practices

### 1. Error Message Guidelines

- **Be specific but not revealing**: Provide enough information to help legitimate users while not exposing system internals to potential attackers
- **Use consistent terminology**: Maintain consistent error messages across the application
- **Provide actionable guidance**: When possible, suggest what the user can do to resolve the issue
- **Include error codes**: Use machine-readable error codes for programmatic handling

### 2. Logging Best Practices

- **Log all errors**: Every error should be logged with appropriate context
- **Include correlation IDs**: Use request IDs to trace errors across systems
- **Sanitize sensitive data**: Never log passwords, tokens, or other sensitive information
- **Use structured logging**: Use JSON format for easier parsing and analysis

### 3. Monitoring and Alerting

- **Set up error rate alerts**: Alert when error rates exceed normal thresholds
- **Monitor specific error types**: Different error types may require different response strategies
- **Track error trends**: Look for patterns that might indicate systemic issues
- **Implement circuit breakers**: Prevent cascading failures by implementing circuit breaker patterns

---

## Related Documentation

- [API Documentation](../api/user-deletion-endpoint.md)
- [Development Guide](./user-deletion-development-guide.md)
- [Testing Guide](../testing/user-deletion-testing-guide.md)
- [Monitoring Strategy](../monitoring/post-deployment-monitoring-strategy.md)
