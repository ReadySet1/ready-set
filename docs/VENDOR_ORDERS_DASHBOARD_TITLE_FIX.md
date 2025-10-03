# Vendor Dashboard Orders Page Title Fix

## Issue

On the vendor dashboard orders page (`/client/orders`), the breadcrumb header was displaying "Client Dashboard" instead of "Vendor Dashboard" for vendor users. This was due to a hardcoded value in the orders page component.

## Root Cause

In `src/app/(site)/(users)/client/orders/page.tsx`, the Breadcrumb component had a hardcoded `pageName` prop:

```tsx
<Breadcrumb pageName="Client Dashboard" />
```

Since this is a **unified dashboard** used by both clients and vendors, the title needs to be dynamic based on the user's role.

## Solution

The fix implements dynamic dashboard title detection based on the authenticated user's role:

1. **Import User Context**: Added `useUser` hook from `@/contexts/UserContext` to access the current user's role
2. **Dynamic Title Logic**: Added role-based title determination:
   ```tsx
   const dashboardTitle =
     userRole?.toUpperCase() === "VENDOR"
       ? "Vendor Dashboard"
       : "Client Dashboard";
   ```
3. **Updated Breadcrumb**: Changed the hardcoded breadcrumb to use the dynamic title:
   ```tsx
   <Breadcrumb pageName={dashboardTitle} />
   ```

## Changes Made

**File**: `src/app/(site)/(users)/client/orders/page.tsx`

### Added Import:

```typescript
import { useUser } from "@/contexts/UserContext";
```

### Added Role Detection (lines 77-102):

```typescript
const ClientOrdersPage = () => {
  // Get user role from context to display correct dashboard title
  const { userRole } = useUser();

  // ... other state declarations ...

  // Determine dashboard title based on user role
  const dashboardTitle = userRole?.toUpperCase() === "VENDOR"
    ? "Vendor Dashboard"
    : "Client Dashboard";
```

### Updated Breadcrumb (line 269):

```typescript
<Breadcrumb pageName={dashboardTitle} />
```

## Testing

To verify the fix:

1. Sign in as a **vendor** user
2. Navigate to the orders page (`/client/orders`)
3. Verify the breadcrumb header displays "**Vendor Dashboard**"
4. Sign in as a **client** user
5. Navigate to the orders page
6. Verify the breadcrumb header displays "**Client Dashboard**"

## Related Files

- `src/app/(site)/(users)/client/orders/page.tsx` - Orders page component (fixed)
- `src/components/Common/Breadcrumb.tsx` - Breadcrumb component that renders the title
- `src/contexts/UserContext.tsx` - User context providing role information
- `src/app/(site)/(users)/client/page.tsx` - Main dashboard page (already implements this pattern)

## Notes

- This follows the same pattern used in the main dashboard page (`/client/page.tsx`) at lines 554-557
- The unified dashboard approach allows both vendors and clients to use the same routes
- The UserContext provides real-time role information from the authenticated session
- No TypeScript or linter errors were introduced by these changes

## Date

October 3, 2025
