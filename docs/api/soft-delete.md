# Soft Delete API Documentation

## Overview

This document provides comprehensive documentation for the User Soft Delete API endpoints. The soft delete system allows administrators to safely remove users while maintaining data integrity and GDPR compliance.

## Table of Contents

- [Authentication & Authorization](#authentication--authorization)
- [Core Endpoints](#core-endpoints)
  - [Soft Delete User](#soft-delete-user)
  - [Restore User](#restore-user)
  - [Permanent Delete User](#permanent-delete-user)
  - [List Deleted Users](#list-deleted-users)
- [Management Endpoints](#management-endpoints)
  - [Cleanup Management](#cleanup-management)
  - [Data Retention](#data-retention)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Audit Trail](#audit-trail)

## Authentication & Authorization

All endpoints require valid authentication via Supabase JWT token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

### Permission Levels

| Operation          | SUPER_ADMIN | ADMIN | HELPDESK | CLIENT/VENDOR/DRIVER |
| ------------------ | ----------- | ----- | -------- | -------------------- |
| Soft Delete        | ✅          | ✅    | ❌       | ❌                   |
| Restore            | ✅          | ✅    | ❌       | ❌                   |
| Permanent Delete   | ✅          | ❌    | ❌       | ❌                   |
| View Deleted Users | ✅          | ✅    | ✅       | ❌                   |
| Cleanup Management | ✅          | ❌    | ❌       | ❌                   |

## Core Endpoints

### Soft Delete User

Moves a user to "trash" without permanently removing their data.

```http
DELETE /api/users/{userId}
```

#### Request Headers

```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

#### Request Body

```json
{
  "reason": "Account violation - spam activity detected"
}
```

| Field    | Type   | Required | Description                                       |
| -------- | ------ | -------- | ------------------------------------------------- |
| `reason` | string | Optional | Reason for deletion (recommended for audit trail) |

#### Success Response (200)

```json
{
  "message": "User soft deleted successfully",
  "summary": {
    "deletedUser": {
      "id": "user-123-456-789",
      "email": "user@example.com",
      "type": "CLIENT"
    },
    "deletedAt": "2024-01-15T10:30:00Z",
    "deletedBy": "admin-456-789-123",
    "deletionReason": "Account violation - spam activity detected",
    "duration": "250ms",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### Error Responses

**401 Unauthorized**

```json
{
  "error": "Unauthorized: Authentication required"
}
```

**403 Forbidden**

```json
{
  "error": "Forbidden: Only Admin or Super Admin can delete users"
}
```

**404 Not Found**

```json
{
  "error": "User not found"
}
```

**409 Conflict**

```json
{
  "error": "User is already soft deleted"
}
```

**409 Conflict - Self Deletion**

```json
{
  "error": "Forbidden: Cannot delete your own account"
}
```

**409 Conflict - Super Admin Protection**

```json
{
  "error": "Forbidden: Super Admin users cannot be deleted"
}
```

**409 Conflict - Active Orders**

```json
{
  "error": "Cannot delete user with active orders. Complete or cancel orders first. Active orders: 3"
}
```

#### Example Usage

```bash
curl -X DELETE \
  https://api.example.com/api/users/user-123-456-789 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"reason": "User requested account deletion"}'
```

---

### Restore User

Restores a soft-deleted user, making them active again.

```http
POST /api/users/{userId}/restore
```

#### Request Headers

```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

#### Request Body

```json
{}
```

_No request body required_

#### Success Response (200)

```json
{
  "message": "User restored successfully",
  "summary": {
    "restoredUser": {
      "id": "user-123-456-789",
      "email": "user@example.com",
      "type": "CLIENT"
    },
    "restoredAt": "2024-01-15T10:35:00Z",
    "restoredBy": "admin-456-789-123",
    "timestamp": "2024-01-15T10:35:00Z"
  }
}
```

#### Error Responses

**409 Conflict - Not Soft Deleted**

```json
{
  "error": "User is not soft deleted",
  "code": "NOT_SOFT_DELETED"
}
```

#### Example Usage

```bash
curl -X POST \
  https://api.example.com/api/users/user-123-456-789/restore \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

---

### Permanent Delete User

Permanently removes a user and all their data from the system (GDPR compliance).

```http
DELETE /api/users/{userId}/purge
```

#### Request Headers

```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

#### Request Body

```json
{
  "reason": "GDPR data deletion request - user explicitly requested complete data removal from system"
}
```

| Field    | Type   | Required     | Description                             |
| -------- | ------ | ------------ | --------------------------------------- |
| `reason` | string | **Required** | Detailed reason (minimum 10 characters) |

#### Success Response (200)

```json
{
  "message": "User permanently deleted successfully",
  "summary": {
    "deletedUser": {
      "id": "user-123-456-789",
      "email": "user@example.com",
      "type": "CLIENT"
    },
    "purgedAt": "2024-01-15T10:40:00Z",
    "purgedBy": "superadmin-789-123-456",
    "reason": "GDPR data deletion request - user explicitly requested complete data removal from system",
    "deletedRecords": {
      "profile": 1,
      "addresses": 3,
      "orders": 5,
      "fileUploads": 12,
      "auditLogs": 28
    },
    "timestamp": "2024-01-15T10:40:00Z"
  }
}
```

#### Error Responses

**400 Bad Request - Invalid Reason**

```json
{
  "error": "Detailed reason is required (minimum 10 characters)"
}
```

**403 Forbidden - Permission Denied**

```json
{
  "error": "Forbidden: Only Super Admin can permanently delete users"
}
```

**409 Conflict - Not Soft Deleted**

```json
{
  "error": "User must be soft deleted before permanent deletion"
}
```

#### Example Usage

```bash
curl -X DELETE \
  https://api.example.com/api/users/user-123-456-789/purge \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"reason": "GDPR compliance - user requested complete data deletion"}'
```

---

### List Deleted Users

Retrieves a paginated list of soft-deleted users with filtering options.

```http
GET /api/users/deleted
```

#### Query Parameters

| Parameter       | Type    | Default   | Description                                                   |
| --------------- | ------- | --------- | ------------------------------------------------------------- |
| `page`          | integer | 1         | Page number for pagination                                    |
| `limit`         | integer | 10        | Number of results per page (max 100)                          |
| `type`          | string  | -         | Filter by user type (CLIENT, VENDOR, DRIVER, ADMIN, HELPDESK) |
| `search`        | string  | -         | Search in name, email, contact name, company name             |
| `deletedBy`     | string  | -         | Filter by who deleted the user (user ID)                      |
| `deletedAfter`  | string  | -         | Filter by deletion date after (ISO 8601)                      |
| `deletedBefore` | string  | -         | Filter by deletion date before (ISO 8601)                     |
| `sort`          | string  | deletedAt | Sort field (deletedAt, name, email, type)                     |
| `direction`     | string  | desc      | Sort direction (asc, desc)                                    |

#### Success Response (200)

```json
{
  "users": [
    {
      "id": "user-123-456-789",
      "email": "user@example.com",
      "name": "John Doe",
      "type": "CLIENT",
      "status": "ACTIVE",
      "companyName": null,
      "contactName": "John Doe",
      "contactNumber": "+1234567890",
      "createdAt": "2024-01-01T00:00:00Z",
      "deletedAt": "2024-01-15T10:30:00Z",
      "deletedBy": "admin-456-789-123",
      "deletionReason": "Account violation - spam activity detected",
      "deletedByUser": {
        "name": "Admin User",
        "email": "admin@example.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalCount": 25,
    "totalPages": 3
  },
  "filters": {
    "type": "CLIENT",
    "search": "john",
    "deletedAfter": "2024-01-01T00:00:00Z"
  },
  "timestamp": "2024-01-15T10:45:00Z"
}
```

#### Error Responses

**403 Forbidden**

```json
{
  "error": "Forbidden: Insufficient permissions to view deleted users"
}
```

#### Example Usage

```bash
# Basic request
curl -X GET \
  "https://api.example.com/api/users/deleted?page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# With filters
curl -X GET \
  "https://api.example.com/api/users/deleted?type=CLIENT&search=john&deletedAfter=2024-01-01T00:00:00Z" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Management Endpoints

### Cleanup Management

Manages automated cleanup of old soft-deleted users.

#### Get Cleanup Metrics

```http
GET /api/admin/cleanup
```

**Query Parameters:**

- `includeReport=true` - Include detailed cleanup report

**Success Response (200):**

```json
{
  "metrics": {
    "totalEligible": 15,
    "processedToday": 5,
    "remainingToProcess": 10,
    "oldestDeletionDate": "2023-10-15T10:30:00Z",
    "newestDeletionDate": "2024-01-10T15:20:00Z"
  },
  "timestamp": "2024-01-15T10:50:00Z",
  "report": {
    "recentCleanups": [
      {
        "id": "audit-789-123-456",
        "userId": "user-cleaned-123",
        "performedAt": "2024-01-14T03:00:00Z",
        "reason": "Automated cleanup: retention period of 90 days exceeded",
        "metadata": {
          "operation": "automated_cleanup",
          "retentionDays": 90
        }
      }
    ],
    "recommendations": [
      "High number of users eligible for cleanup. Consider increasing batch size or frequency."
    ]
  }
}
```

#### Run Manual Cleanup

```http
POST /api/admin/cleanup
```

**Request Body:**

```json
{
  "dryRun": true,
  "retentionDays": 90,
  "batchSize": 50,
  "maxDailyDeletions": 1000,
  "force": false
}
```

**Success Response (200):**

```json
{
  "message": "Manual cleanup dry-run completed",
  "result": {
    "success": true,
    "processed": 15,
    "permanentlyDeleted": 0,
    "archived": 15,
    "errors": [],
    "duration": 2500,
    "timestamp": "2024-01-15T10:55:00Z"
  },
  "performedBy": {
    "id": "superadmin-789-123-456",
    "email": "superadmin@example.com"
  }
}
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE_IF_APPLICABLE",
  "details": "Additional technical details if available",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common Error Codes

| Code                    | Description                   |
| ----------------------- | ----------------------------- |
| `USER_NOT_FOUND`        | User does not exist           |
| `NOT_SOFT_DELETED`      | User is not soft deleted      |
| `ALREADY_SOFT_DELETED`  | User is already soft deleted  |
| `VALIDATION_ERROR`      | Request validation failed     |
| `PERMISSION_DENIED`     | Insufficient permissions      |
| `ACTIVE_ORDERS_EXIST`   | User has active orders        |
| `SELF_DELETION_DENIED`  | Cannot delete own account     |
| `SUPER_ADMIN_PROTECTED` | Super admin cannot be deleted |

---

## Rate Limiting

All endpoints are subject to rate limiting:

- **Standard endpoints**: 100 requests per minute per user
- **Cleanup endpoints**: 10 requests per minute per user
- **Bulk operations**: 5 requests per minute per user

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

---

## Audit Trail

All soft delete operations are automatically logged in the audit trail:

### Audit Log Entry Structure

```json
{
  "id": "audit-123-456-789",
  "userId": "user-123-456-789",
  "action": "SOFT_DELETE",
  "performedBy": "admin-456-789-123",
  "performedAt": "2024-01-15T10:30:00Z",
  "changes": {
    "before": {
      "deletedAt": null,
      "deletedBy": null,
      "deletionReason": null
    },
    "after": {
      "deletedAt": "2024-01-15T10:30:00Z",
      "deletedBy": "admin-456-789-123",
      "deletionReason": "Account violation - spam activity detected"
    }
  },
  "reason": "User soft deleted",
  "metadata": {
    "operation": "soft_delete",
    "timestamp": "2024-01-15T10:30:00Z",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### Audit Actions

| Action                     | Description              |
| -------------------------- | ------------------------ |
| `SOFT_DELETE`              | User moved to trash      |
| `RESTORE`                  | User restored from trash |
| `PERMANENT_DELETE`         | User permanently deleted |
| `MANUAL_CLEANUP_INITIATED` | Manual cleanup started   |
| `MANUAL_CLEANUP_COMPLETED` | Manual cleanup finished  |

---

## Data Retention Policies

### Default Retention Periods

| User Type   | Retention Days | Auto Delete | Notes                                      |
| ----------- | -------------- | ----------- | ------------------------------------------ |
| CLIENT      | 90             | Yes         | Standard GDPR compliance                   |
| VENDOR      | 90             | Yes         | Standard GDPR compliance                   |
| DRIVER      | 90             | Yes         | Standard GDPR compliance                   |
| ADMIN       | 365            | No          | Extended retention, manual review required |
| HELPDESK    | 365            | No          | Extended retention, manual review required |
| SUPER_ADMIN | ∞              | No          | Manual deletion only                       |

### GDPR Compliance

- All retention periods comply with GDPR requirements
- Users can request immediate permanent deletion
- Audit trail maintained for compliance reporting
- Data minimization principles applied

---

## Best Practices

### For Administrators

1. **Always provide deletion reasons** for better audit trails
2. **Use dry-run mode** before permanent cleanup operations
3. **Monitor cleanup metrics** regularly
4. **Review retention policies** quarterly
5. **Test restore functionality** periodically

### For Developers

1. **Handle all error codes** appropriately in UI
2. **Implement proper loading states** for long operations
3. **Show confirmation dialogs** for destructive actions
4. **Cache deleted users list** with appropriate invalidation
5. **Use pagination** for large datasets

### Security Considerations

1. **Never expose user data** in error messages
2. **Log all administrative actions** for audit
3. **Validate user permissions** on every request
4. **Use HTTPS** for all API communication
5. **Rotate API keys** regularly

---

## Changelog

### Version 2.0 (2024-01-15)

- Added comprehensive soft delete system
- Implemented GDPR compliance features
- Added automated cleanup functionality
- Enhanced audit trail capabilities

### Version 1.0 (2023-12-01)

- Initial API documentation
- Basic user management endpoints
