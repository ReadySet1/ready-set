# User Deletion API Endpoint

## Overview

The User Deletion API endpoint provides a secure, comprehensive solution for deleting user profiles and their associated data while maintaining data integrity and audit compliance.

**Endpoint**: `DELETE /api/users/[userId]`

## Authentication & Authorization

### Required Authentication

- **Supabase JWT Token**: Must be provided via Authorization header
- **Valid Session**: User must have an active authenticated session

### Authorization Requirements

- **ADMIN** or **SUPER_ADMIN** role required
- **Self-deletion prevention**: Users cannot delete their own accounts
- **SUPER_ADMIN protection**: SUPER_ADMIN users cannot be deleted by anyone

## Request Format

### HTTP Method

```
DELETE /api/users/{userId}
```

### Headers

```http
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json
```

### Path Parameters

| Parameter | Type          | Required | Description                                 |
| --------- | ------------- | -------- | ------------------------------------------- |
| `userId`  | string (UUID) | Yes      | The unique identifier of the user to delete |

### Example Request

```bash
curl -X DELETE \
  https://your-app.com/api/users/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

## Response Format

### Success Response (200 OK)

```json
{
  "message": "User deletion completed successfully",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "userEmail": "user@example.com",
  "userType": "VENDOR",
  "deletionSummary": {
    "deletedProfile": {
      "id": "123e4567-e89b-12d3-a456-426614174000"
    },
    "deletedDispatches": 3,
    "updatedFileUploads": 5,
    "deletedAddresses": 2,
    "updatedAddresses": 1,
    "totalAddressesProcessed": 3,
    "cascadeDeleted": {
      "accounts": "automatic",
      "sessions": "automatic",
      "userAddresses": "automatic",
      "cateringRequests": "automatic",
      "onDemandRequests": "automatic"
    }
  },
  "operationDuration": "1847ms",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Responses

#### 400 Bad Request - Invalid User ID

```json
{
  "error": "Invalid user ID format",
  "code": "INVALID_USER_ID",
  "details": "User ID must be a valid UUID"
}
```

#### 401 Unauthorized - Not Authenticated

```json
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_REQUIRED",
  "details": "Valid authentication token must be provided"
}
```

#### 403 Forbidden - Insufficient Permissions

```json
{
  "error": "Insufficient permissions",
  "code": "INSUFFICIENT_PERMISSIONS",
  "details": "Only ADMIN or SUPER_ADMIN users can delete other users"
}
```

#### 403 Forbidden - Self Deletion Attempt

```json
{
  "error": "Self-deletion is not allowed",
  "code": "SELF_DELETION_FORBIDDEN",
  "details": "Users cannot delete their own accounts. Please contact an administrator."
}
```

#### 403 Forbidden - SUPER_ADMIN Protection

```json
{
  "error": "SUPER_ADMIN users cannot be deleted",
  "code": "SUPER_ADMIN_PROTECTED",
  "details": "SUPER_ADMIN users are protected from deletion for security reasons"
}
```

#### 404 Not Found - User Does Not Exist

```json
{
  "error": "User not found",
  "code": "USER_NOT_FOUND",
  "details": "The specified user does not exist or has already been deleted"
}
```

#### 408 Request Timeout - Transaction Timeout

```json
{
  "error": "Deletion operation timed out",
  "code": "TRANSACTION_TIMEOUT",
  "details": "The deletion operation exceeded the maximum allowed time limit"
}
```

#### 409 Conflict - Active Orders

```json
{
  "error": "Cannot delete user with active orders",
  "code": "ACTIVE_ORDERS_EXIST",
  "details": "User has 2 active catering orders and 1 active on-demand order. Complete or cancel these orders before deletion.",
  "activeOrders": {
    "cateringOrders": 2,
    "onDemandOrders": 1
  }
}
```

#### 500 Internal Server Error - Database Constraint Violation

```json
{
  "error": "Database constraint violation",
  "code": "CONSTRAINT_VIOLATION",
  "details": "Foreign key constraint violation prevented deletion"
}
```

#### 500 Internal Server Error - Unexpected Database Error

```json
{
  "error": "Database operation failed",
  "code": "DATABASE_ERROR",
  "details": "An unexpected database error occurred during deletion"
}
```

#### 503 Service Unavailable - Database Connection Error

```json
{
  "error": "Database connection failed",
  "code": "DATABASE_CONNECTION_ERROR",
  "details": "Unable to establish database connection"
}
```

## Data Deletion Process

### 1. Pre-Deletion Validation

- **User Existence Check**: Verify the target user exists
- **Authorization Validation**: Confirm requester permissions
- **Active Orders Check**: Prevent deletion if user has active orders
- **Self-Deletion Check**: Block users from deleting themselves
- **SUPER_ADMIN Protection**: Prevent SUPER_ADMIN deletion

### 2. Transaction-Based Deletion

All deletion operations are performed within a database transaction to ensure atomicity:

```typescript
await prisma.$transaction(
  async (tx) => {
    // 1. Manual cleanup operations
    // 2. Profile deletion (triggers cascades)
  },
  { timeout: 10000 },
);
```

### 3. Manual Cleanup Operations

Operations that require explicit handling before profile deletion:

#### Dispatch Records

```sql
DELETE FROM dispatches
WHERE "driverId" = $userId OR "userId" = $userId;
```

#### File Upload References

```sql
UPDATE file_uploads
SET "userId" = NULL
WHERE "userId" = $userId;
```

#### Address Management

- **Unused Addresses**: Deleted if not referenced by other entities
- **Shared Addresses**: `createdBy` field set to NULL

### 4. Automatic Cascade Deletions

The following are automatically deleted when the profile is removed:

- **Accounts**: User authentication accounts
- **Sessions**: Active user sessions
- **User Addresses**: User-address relationships
- **Catering Requests**: User's catering orders
- **On-Demand Requests**: User's on-demand orders

### 5. Audit Trail Creation

Every deletion attempt is logged with:

- **Performer Information**: Who initiated the deletion
- **Target Information**: User being deleted
- **Operation Details**: Success/failure status and timing
- **Affected Records**: Count of deleted/updated records
- **Error Information**: Detailed error context if failed

## Performance Characteristics

### Response Times

- **Simple Deletion**: < 2 seconds (minimal related data)
- **Complex Deletion**: < 5 seconds (moderate related data)
- **Heavy Deletion**: < 8 seconds (extensive related data)

### Transaction Timeout

- **Default Timeout**: 10 seconds
- **Timeout Handling**: Automatic rollback on timeout
- **Retry Logic**: Not implemented (manual retry required)

### Resource Usage

- **Memory Usage**: Typically < 50MB per operation
- **Database Connections**: Uses connection pooling
- **Concurrent Operations**: Supported with proper locking

## Security Considerations

### Data Protection

- **Audit Logging**: All operations logged for compliance
- **Authorization Enforcement**: Role-based access control
- **Input Validation**: UUID format validation for user IDs
- **SQL Injection Prevention**: Parameterized queries used throughout

### Compliance Features

- **GDPR Compliance**: Complete data removal capabilities
- **Right to be Forgotten**: Comprehensive data deletion
- **Audit Trail**: Complete operation history
- **Data Retention**: Configurable audit log retention

## Integration Examples

### Frontend Integration (React)

```typescript
import { supabase } from "@/utils/supabase/client";

const deleteUser = async (userId: string) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`/api/users/${userId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error);
    }

    const result = await response.json();
    console.log("User deleted successfully:", result);

    return result;
  } catch (error) {
    console.error("Failed to delete user:", error);
    throw error;
  }
};
```

### Backend Integration (Server Action)

```typescript
"use server";

import { createClient } from "@/utils/supabase/server";

export async function deleteUserAction(userId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/users/${userId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.details || result.error };
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

## Testing

### Unit Tests

Location: `src/__tests__/api/users/userId-delete.test.ts`
Coverage: All authorization paths, error scenarios, and business logic

### Integration Tests

Location: `src/__tests__/integration/user-deletion-flow.integration.test.ts`
Coverage: End-to-end deletion workflows and database state verification

### Performance Tests

Location: `src/__tests__/performance/user-deletion-performance.test.ts`
Coverage: Response time validation and resource usage analysis

## Monitoring and Observability

### Real-time Monitoring

- **Error Rate Tracking**: < 1% error rate target
- **Performance Monitoring**: Response time and resource usage
- **Success Rate Monitoring**: > 99% success rate target

### Data Integrity Monitoring

- **Orphaned Record Detection**: Automated scanning
- **Constraint Validation**: Foreign key integrity checks
- **Audit Trail Verification**: Completeness validation

### Usage Analytics

- **Pattern Analysis**: Deletion frequency and timing patterns
- **Performance Trends**: Response time and resource usage trends
- **Failure Analysis**: Error classification and root cause analysis

## Troubleshooting

### Common Issues

**High Error Rates**

- Check authorization configuration
- Verify database connectivity
- Review transaction timeout settings

**Slow Performance**

- Analyze database query performance
- Check for database lock contention
- Review connection pool configuration

**Data Integrity Issues**

- Run data integrity validation script
- Check for orphaned records
- Verify cascade deletion configuration

### Debug Information

Enable debug logging by setting environment variables:

```bash
DEBUG=true
LOG_LEVEL=debug
```

## Rate Limiting

### Current Limits

- **Per User**: 10 deletion requests per minute
- **Per IP**: 50 deletion requests per minute
- **Global**: 1000 deletion requests per minute

### Rate Limit Headers

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1640995200
```

## API Versioning

### Current Version

- **Version**: v1
- **Stability**: Stable
- **Deprecation**: No current deprecation plans

### Future Considerations

- **Soft Delete Option**: Planned for v2
- **Batch Deletion**: Under consideration
- **Async Deletion**: For large datasets

## Support

### Getting Help

- **Documentation**: This API documentation
- **Issues**: GitHub repository issues
- **Support**: Contact development team

### Related Documentation

- [Deployment Strategy](../deployment/user-deletion-deployment-strategy.md)
- [Testing Strategy](../testing/user-deletion-testing-guide.md)
- [Monitoring Strategy](../monitoring/post-deployment-monitoring-strategy.md)
- [Database Schema](../database/schema-relationships.md)
