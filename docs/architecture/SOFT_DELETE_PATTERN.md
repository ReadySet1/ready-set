# Soft Delete Pattern Guide

> **Priority: CRITICAL** - This is the #1 source of bugs for new developers. Read this before writing any database queries involving users or related data.

## Overview

Ready Set uses **soft delete** instead of hard delete for user data. When a user is "deleted," we set a `deletedAt` timestamp rather than removing the record from the database.

This preserves:
- Historical order data
- Audit trails
- Data integrity for related records

## The Golden Rule

**Every database query must filter out soft-deleted records.**

```typescript
// CORRECT - Always include deletedAt: null
const users = await prisma.profile.findMany({
  where: { deletedAt: null }
});

// WRONG - This includes deleted users!
const users = await prisma.profile.findMany();
```

---

## How Soft Delete Works

### Database Schema

All soft-deletable models have these fields:

```prisma
model Profile {
  // ... other fields
  deletedAt       DateTime?         @db.Timestamptz(6)
  deletedBy       String?           // User ID who performed deletion
  deletionReason  String?           // Optional reason
}
```

### Models with Soft Delete

| Model | Has deletedAt | Notes |
|-------|---------------|-------|
| `Profile` | Yes | Primary user record |
| `Address` | Yes | User addresses |
| `CateringRequest` | Yes | Catering orders |
| `OnDemand` | Yes | On-demand requests |
| `JobApplication` | Yes | Job applications |
| `DriverShift` | Yes | Driver shift records |
| `DriverBreak` | Yes | Driver break records |
| `DriverLocationHistory` | Yes | Location tracking |
| `Worklog` | Yes | Time tracking |

---

## Prisma Middleware

We have middleware that **partially** handles soft delete filtering, but **it's not foolproof**.

**Location**: `src/lib/prisma/middleware/softDelete.ts`

The middleware automatically filters:
- `Profile` queries (findMany, findFirst, findUnique, count, aggregate)
- Related entity queries (CateringRequest, Dispatch, FileUpload, etc.)

### Limitations

The middleware does **NOT** cover:
- Raw SQL queries
- Complex nested queries
- Some edge cases with `include` statements

**Best practice**: Always add `deletedAt: null` explicitly, even if middleware exists.

---

## Query Patterns

### Basic User Query

```typescript
// CORRECT
const activeUsers = await prisma.profile.findMany({
  where: {
    deletedAt: null,
    type: 'CLIENT'
  }
});

// WRONG
const users = await prisma.profile.findMany({
  where: { type: 'CLIENT' }
});
```

### Finding a Single User

```typescript
// CORRECT
const user = await prisma.profile.findFirst({
  where: {
    id: userId,
    deletedAt: null
  }
});

// WRONG - may return deleted user
const user = await prisma.profile.findUnique({
  where: { id: userId }
});
```

### Queries with Relations

When querying related data, filter the user relationship:

```typescript
// CORRECT - Filter orders from active users only
const orders = await prisma.cateringRequest.findMany({
  where: {
    status: 'PENDING',
    user: {
      deletedAt: null  // Important!
    }
  }
});

// WRONG - May include orders from deleted users
const orders = await prisma.cateringRequest.findMany({
  where: { status: 'PENDING' }
});
```

### Counting Users

```typescript
// CORRECT
const activeCount = await prisma.profile.count({
  where: {
    type: 'DRIVER',
    deletedAt: null
  }
});

// WRONG
const count = await prisma.profile.count({
  where: { type: 'DRIVER' }
});
```

---

## Including Deleted Records

Sometimes you need to see deleted records (admin views, audits). Use the `includeDeleted` flag:

```typescript
// To include deleted records (admin/audit purposes only)
const allUsers = await prisma.profile.findMany({
  where: { type: 'CLIENT' },
  // @ts-ignore - custom flag handled by middleware
  includeDeleted: true
});
```

The middleware will strip this flag before the query runs.

---

## Helper Functions

Use the helpers in `src/lib/softDeleteHelpers.ts`:

### Pre-built Filters

```typescript
import { softDeleteFilters } from '@/lib/softDeleteHelpers';

// Active users only
const users = await prisma.profile.findMany({
  where: softDeleteFilters.activeUsers()
});

// Orders from active users
const orders = await prisma.cateringRequest.findMany({
  where: softDeleteFilters.ordersFromActiveUsers()
});

// Available drivers
const drivers = await prisma.profile.findMany({
  where: softDeleteBusinessLogic.getAvailableDriversFilter()
});
```

### Validation Functions

```typescript
import { softDeleteValidations } from '@/lib/softDeleteHelpers';

// Check if user is active
if (!softDeleteValidations.isUserActive(user)) {
  throw new Error('User account has been deactivated');
}

// Check if driver can be assigned
if (!softDeleteValidations.canDriverBeAssigned(driver)) {
  throw new Error('Driver is not available');
}
```

---

## Performing Soft Delete

### Deleting a User

```typescript
import { softDeleteProfile } from '@/lib/prisma/middleware/softDelete';

// Soft delete a profile
await softDeleteProfile(prisma, userId);

// Or manually:
await prisma.profile.update({
  where: { id: userId },
  data: {
    deletedAt: new Date(),
    deletedBy: adminUserId,
    deletionReason: 'User requested account deletion'
  }
});
```

### Restoring a Deleted User

```typescript
import { restoreProfile } from '@/lib/prisma/middleware/softDelete';

await restoreProfile(prisma, userId);

// Or manually:
await prisma.profile.update({
  where: { id: userId },
  data: { deletedAt: null }
});
```

---

## Common Mistakes

### Mistake 1: Forgetting to Filter

```typescript
// BUG: Returns deleted users
const users = await prisma.profile.findMany();
```

**Fix**: Always add `where: { deletedAt: null }`

### Mistake 2: Missing Filter on Relations

```typescript
// BUG: May show orders from deleted users
const orders = await prisma.cateringRequest.findMany({
  include: { user: true }
});
```

**Fix**: Add filter on the user relation:
```typescript
const orders = await prisma.cateringRequest.findMany({
  where: {
    user: { deletedAt: null }
  },
  include: { user: true }
});
```

### Mistake 3: Using findUnique Without Filter

```typescript
// BUG: findUnique doesn't support complex where clauses
const user = await prisma.profile.findUnique({
  where: { id: userId, deletedAt: null } // Error!
});
```

**Fix**: Use findFirst instead:
```typescript
const user = await prisma.profile.findFirst({
  where: { id: userId, deletedAt: null }
});
```

### Mistake 4: Assigning to Deleted Users

```typescript
// BUG: Driver might be deleted
const dispatch = await prisma.dispatch.create({
  data: {
    driverId: driverId,  // Is this driver active?
    orderId: orderId
  }
});
```

**Fix**: Validate first:
```typescript
const driver = await prisma.profile.findFirst({
  where: { id: driverId, deletedAt: null, type: 'DRIVER' }
});

if (!driver) {
  throw new Error('Driver not available');
}

const dispatch = await prisma.dispatch.create({
  data: { driverId, orderId }
});
```

---

## Testing Soft Delete

When writing tests, verify soft delete behavior:

```typescript
describe('User Query', () => {
  it('should not return soft-deleted users', async () => {
    // Create a user
    const user = await createTestUser();

    // Soft delete them
    await prisma.profile.update({
      where: { id: user.id },
      data: { deletedAt: new Date() }
    });

    // Query should not return them
    const result = await getUserById(user.id);
    expect(result).toBeNull();
  });
});
```

See tests in `src/app/api/users/__tests__/softDelete.integration.test.ts` for examples.

---

## Checklist for New Queries

Before merging any PR with database queries:

- [ ] Does the query involve `Profile` or user-related data?
- [ ] Is `deletedAt: null` included in the where clause?
- [ ] Are related user filters applied (e.g., `user: { deletedAt: null }`)?
- [ ] Did you consider what happens if the user is deleted mid-operation?
- [ ] Are you using `findFirst` instead of `findUnique` when filtering?

---

## Related Documentation

- [Soft Delete API Documentation](../api/soft-delete.md)
- [User Deletion Endpoint](../api/user-deletion-endpoint.md)
- [Soft Delete Implementation Phase 1-2](../soft-delete-implementation-phase1-2.md)
- [Soft Delete Implementation Phase 3-4](../soft-delete-implementation-phase3-4.md)
