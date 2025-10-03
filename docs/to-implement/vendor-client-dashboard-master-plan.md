# Vendor/Client Dashboard Master Plan

## 🎯 Feature Overview

**Name**: Unified Dashboard with Role-Based Title
**Type**: Enhancement
**Priority**: P1-High
**Complexity**: S (1-2d)
**Sprint**: Dashboard Enhancement | **Epic**: User Role Management

### Problem Statement (Jobs To Be Done)

**When** a vendor logs into the platform, **I want to** see the same functional dashboard as clients but with "Vendor Dashboard" as the title, **so that** I can manage my operations using the proven, existing dashboard interface without confusion about my role.

**Current State**:

- Client dashboard exists at `/client/page.tsx` with hardcoded "Client Dashboard" title
- Vendor page exists at `/vendor/page.tsx` with separate implementation
- UserType enum already supports 'CLIENT' and 'VENDOR' roles

**Desired State**:

- Both roles use the same dashboard component
- Title dynamically changes: "Client Dashboard" for clients, "Vendor Dashboard" for vendors
- Maximum code reuse, minimal complexity

**Impact**: Code consolidation, consistent UX, easier maintenance, reduced technical debt

### Success Metrics

- [ ] **Functional**: Dynamic title displays correctly based on user role
- [ ] **Performance**: No performance degradation (same component, minimal logic added)
- [ ] **Quality**: All existing client functionality preserved and working for vendors
- [ ] **Business**: Vendors have full dashboard access with proper role identification

### Dependencies & Risks

**External Dependencies**: Existing user authentication system (already has UserType)
**Technical Risks**: Minimal - just routing and title logic changes
**Mitigation Strategy**: Keep existing client dashboard intact, add role detection wrapper

---

## 📋 Technical Architecture

### 1. Current File Structure (No Changes Needed!)

```
src/
├── app/
│   ├── (site)/(users)/
│   │   ├── client/
│   │   │   └── page.tsx              # ✅ Existing dashboard - keep as-is
│   │   └── vendor/
│   │       └── page.tsx              # 🔄 Will be updated to reuse client dashboard
│   │
├── components/
│   └── Common/
│       └── Breadcrumb.tsx            # ✅ Already accepts dynamic pageName prop
│   │
├── types/
│   ├── user.ts                       # ✅ Already has UserType enum
│   └── prisma.ts                     # ✅ UserType already defined
```

### 2. Existing Types (Already Perfect!)

```tsx
// types/user.ts - Already exists!
export enum UserType {
  VENDOR = "vendor",
  CLIENT = "client",
  DRIVER = "driver",
  ADMIN = "admin",
  HELPDESK = "helpdesk",
  SUPER_ADMIN = "super_admin",
}

// types/prisma.ts - Already exists!
export type UserType =
  | "VENDOR"
  | "CLIENT"
  | "DRIVER"
  | "ADMIN"
  | "HELPDESK"
  | "SUPER_ADMIN";
export const UserType = {
  VENDOR: "VENDOR" as const,
  CLIENT: "CLIENT" as const,
  // ... other roles
};
```

### 3. Simple Implementation Approach

**Step 1: Extract Reusable Dashboard Component**

```tsx
// app/(site)/(users)/client/page.tsx
// Keep existing component, just add role prop support
export default async function ClientDashboardPage() {
  const user = await getCurrentUser();
  // ... existing logic
  const dashboardData = await getClientDashboardData(user.id);

  // Get dynamic title based on user role
  const dashboardTitle =
    user.role === "VENDOR" ? "Vendor Dashboard" : "Client Dashboard";

  return (
    <>
      <Breadcrumb
        pageName={dashboardTitle} // 👈 Dynamic title
        pageDescription="Manage your account"
      />
      {/* ... rest of existing dashboard code ... */}
    </>
  );
}
```

**Step 2: Create Shared Dashboard Component (Optional - for better reusability)**

```tsx
// components/Dashboard/UnifiedDashboard.tsx
interface UnifiedDashboardProps {
  user: {
    id: string;
    email: string;
    role: string;
  };
  dashboardData: ClientDashboardData;
}

export function UnifiedDashboard({
  user,
  dashboardData,
}: UnifiedDashboardProps) {
  const dashboardTitle =
    user.role === "VENDOR" ? "Vendor Dashboard" : "Client Dashboard";

  return (
    <>
      <Breadcrumb
        pageName={dashboardTitle}
        pageDescription="Manage your account"
      />
      {/* Existing dashboard JSX from client/page.tsx */}
    </>
  );
}
```

**Step 3: Update Vendor Page to Use Client Dashboard**

```tsx
// app/(site)/(users)/vendor/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function VendorDashboardPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "VENDOR") {
    redirect("/sign-in");
  }

  // Simply redirect to the unified dashboard at /client
  // OR reuse the client dashboard component directly
  redirect("/client");
}
```

**Alternative Step 3: Use Shared Component**

```tsx
// app/(site)/(users)/vendor/page.tsx
import { UnifiedDashboard } from "@/components/Dashboard/UnifiedDashboard";
import { getCurrentUser } from "@/lib/auth";
import { getClientDashboardData } from "@/app/(site)/(users)/client/page";

export default async function VendorDashboardPage() {
  const user = await getCurrentUser();
  const dashboardData = await getClientDashboardData(user.id);

  return <UnifiedDashboard user={user} dashboardData={dashboardData} />;
}
```

### 4. Database Schema (Already Exists!)

```sql
-- ✅ Users table already has user_type column
-- No migration needed! The database is ready.

-- Current schema (from existing Prisma):
-- users.user_type ENUM ('CLIENT', 'VENDOR', 'DRIVER', 'ADMIN', 'HELPDESK', 'SUPER_ADMIN')
```

---

## 🚀 Implementation Plan

### Phase 1: Extract and Prepare Dashboard Component (2-3 hours)

**Goal**: Make the client dashboard reusable

#### Tasks:

1. **Update Client Dashboard Page**
   - [x] Review current `client/page.tsx` structure
   - [ ] Add role detection logic: `user.user_type === 'VENDOR' ? 'Vendor Dashboard' : 'Client Dashboard'`
   - [ ] Pass dynamic title to Breadcrumb component
   - [ ] Verify user role is available from `getCurrentUser()`

2. **Test Current Functionality**
   - [ ] Run existing client dashboard to ensure it works
   - [ ] Check that user role is properly returned from auth
   - [ ] Confirm Breadcrumb component accepts dynamic titles

### Phase 2: Update Vendor Page to Reuse Dashboard (2-3 hours)

**Goal**: Make vendor route use the same dashboard component

#### Tasks:

**Option A: Simple Redirect (Recommended for MVP)**

1. **Update Vendor Page**
   - [ ] Modify `/vendor/page.tsx` to redirect vendors to `/client`
   - [ ] Add role validation to ensure only vendors access this route
   - [ ] Update navigation links to point vendors to `/client`

**Option B: Shared Component (Better long-term)**

1. **Create Shared Dashboard Component**
   - [ ] Extract dashboard JSX from `client/page.tsx` into `UnifiedDashboard.tsx`
   - [ ] Move `getClientDashboardData` to shared location or make it reusable
   - [ ] Update both `/client/page.tsx` and `/vendor/page.tsx` to use shared component

2. **Update Both Routes**
   - [ ] Import and use `UnifiedDashboard` in client page
   - [ ] Import and use `UnifiedDashboard` in vendor page
   - [ ] Pass user role to determine title

### Phase 3: Testing & Validation (1-2 hours)

**Goal**: Ensure both roles work perfectly

#### Tasks:

1. **Manual Testing**
   - [ ] Test as CLIENT user - should see "Client Dashboard"
   - [ ] Test as VENDOR user - should see "Vendor Dashboard"
   - [ ] Verify all dashboard features work for both roles
   - [ ] Check mobile responsiveness for both

2. **Automated Testing (Optional)**
   - [ ] Update existing dashboard tests to test both roles
   - [ ] Add snapshot tests for title variations
   - [ ] E2E test for vendor login → dashboard flow

3. **Clean Up**
   - [ ] Remove old vendor dashboard implementation if not needed
   - [ ] Update any hardcoded navigation links
   - [ ] Update documentation

---

## ✅ Testing Strategy

### Manual Testing Checklist

**Client User Testing**

- [ ] Login as CLIENT user
- [ ] Navigate to `/client` dashboard
- [ ] Verify breadcrumb shows "Client Dashboard"
- [ ] Verify all existing features work (orders, stats, quick actions)
- [ ] Test on mobile/tablet viewports
- [ ] Check navigation links work correctly

**Vendor User Testing**

- [ ] Login as VENDOR user
- [ ] Navigate to `/client` or `/vendor` dashboard (depending on implementation)
- [ ] Verify breadcrumb shows "Vendor Dashboard"
- [ ] Verify all dashboard features work identically to client
- [ ] Test order creation, viewing, and management
- [ ] Check addresses and profile management
- [ ] Test on mobile/tablet viewports

### Unit Tests (Optional Enhancement)

```tsx
// __tests__/components/Dashboard/UnifiedDashboard.test.tsx
describe("UnifiedDashboard", () => {
  it("displays 'Client Dashboard' title for client role", () => {
    const mockUser = { id: "1", email: "client@test.com", user_type: "CLIENT" };
    render(<UnifiedDashboard user={mockUser} dashboardData={mockData} />);
    expect(screen.getByText("Client Dashboard")).toBeInTheDocument();
  });

  it("displays 'Vendor Dashboard' title for vendor role", () => {
    const mockUser = { id: "2", email: "vendor@test.com", user_type: "VENDOR" };
    render(<UnifiedDashboard user={mockUser} dashboardData={mockData} />);
    expect(screen.getByText("Vendor Dashboard")).toBeInTheDocument();
  });

  it("renders all dashboard features for both roles", () => {
    // Test that stats, orders, and quick actions render for both
  });
});
```

### E2E Tests (Playwright)

```tsx
// e2e/dashboard-roles.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Role-based Dashboard", () => {
  test("client user sees client dashboard title", async ({ page }) => {
    await page.goto("/sign-in");
    await page.fill('[name="email"]', "client@test.com");
    await page.fill('[name="password"]', "password123");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/client");
    await expect(page.locator("h1")).toContainText("Client Dashboard");
  });

  test("vendor user sees vendor dashboard title", async ({ page }) => {
    await page.goto("/sign-in");
    await page.fill('[name="email"]', "vendor@test.com");
    await page.fill('[name="password"]', "password123");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/client"); // or **/vendor depending on implementation
    await expect(page.locator("h1")).toContainText("Vendor Dashboard");
  });
});
```

---

## 🔒 Security Considerations

### Authentication & Authorization (Already Handled!)

- ✅ **Server-side validation**: `getCurrentUser()` already validates user server-side
- ✅ **Session management**: Existing auth system handles role in session
- ✅ **Route protection**: Middleware already protects authenticated routes
- ⚠️ **Role-based redirects**: Ensure users can't access wrong dashboard (already in place)

### Key Security Points

1. **Title Display Only**
   - Dashboard title is cosmetic - no security risk
   - All data access already filtered by user ID
   - No new permissions needed since both roles see same features

2. **Data Access** (No Changes Needed)
   - Existing queries already filter by `user.id`
   - Vendors and clients see only their own orders
   - No new data exposure risk

3. **What to Verify**
   - [ ] Confirm `user.user_type` is not client-modifiable
   - [ ] Ensure role check happens server-side in page component
   - [ ] Test that vendors can't access other users' data

---

## 📊 Migration Strategy

### No Database Migration Needed! 🎉

The `users` table already has the `user_type` column with CLIENT and VENDOR values. No schema changes required.

### Deployment Strategy

1. **Phase 1: Update Client Dashboard** (Zero Risk)
   - Add dynamic title logic to existing `/client/page.tsx`
   - Deploy to production
   - Existing clients see no change (still "Client Dashboard")
   - Vendors don't use this page yet, so no impact

2. **Phase 2: Update Vendor Route** (Low Risk)
   - Update `/vendor/page.tsx` to use client dashboard
   - Deploy to production
   - Vendors now see proper dashboard with "Vendor Dashboard" title
   - Clients unaffected

3. **Rollback Plan** (if needed)
   - Revert vendor page to previous implementation
   - Client dashboard remains untouched
   - No data changes to rollback

### Testing Checklist

- [ ] Test on staging with real CLIENT users
- [ ] Test on staging with real VENDOR users
- [ ] Verify no console errors
- [ ] Check mobile responsiveness
- [ ] Test all dashboard actions (create order, view orders, etc.)

---

## 🎯 Success Metrics & Monitoring

### Key Success Indicators

- ✅ **Functional**: Vendors see "Vendor Dashboard", clients see "Client Dashboard"
- ✅ **Performance**: No performance impact (same component, same queries)
- ✅ **User Experience**: Zero confusion about user role
- ✅ **Code Quality**: DRY principle - one dashboard component for both roles

### Simple Monitoring

**Week 1 After Launch:**

- [ ] Check error logs for any role-related issues
- [ ] Verify vendors are successfully accessing dashboard
- [ ] Monitor any support tickets about dashboard confusion
- [ ] Quick feedback survey: "Does your dashboard clearly show your role?"

**Ongoing:**

- [ ] Track dashboard load times (should remain unchanged)
- [ ] Monitor authentication success rates
- [ ] Watch for any unusual access patterns

---

## 📅 Timeline Summary

| Phase                            | Duration  | Key Deliverables                   |
| -------------------------------- | --------- | ---------------------------------- |
| Phase 1: Update Client Dashboard | 2-3 hours | Dynamic title based on role        |
| Phase 2: Update Vendor Route     | 2-3 hours | Vendor page uses client dashboard  |
| Phase 3: Testing & Validation    | 1-2 hours | Manual testing both roles, cleanup |

**Total Estimated Effort**: 5-8 hours (1 day)
**Complexity**: Simple - just title logic and routing
**Risk Level**: Very Low - no schema changes, minimal code changes

---

## 🔄 Post-Launch Plan

### Day 1-3: Quick Validation

- [ ] Monitor Sentry/error logs for any issues
- [ ] Test with 2-3 real vendors if possible
- [ ] Verify no regression for existing clients
- [ ] Address any critical bugs immediately

### Week 1-2: Gather Feedback

- [ ] Ask vendors: "Is the dashboard clear and useful?"
- [ ] Check analytics: Are vendors accessing all dashboard features?
- [ ] Monitor support tickets
- [ ] Document any common issues

### Future Enhancements (If Needed)

- Vendor-specific metrics or features
- Custom vendor navigation items
- Vendor-specific quick actions
- Advanced analytics for vendor operations

**Note**: This implementation keeps it simple. Future vendor-specific features can be added incrementally without architectural changes.

---

**Version**: 2.0 (Simplified)
**Updated**: October 2, 2025
**Project Location**: `/Users/fersanz/Documents/ready-set`
**Maintainer**: Development Team
**Status**: Ready for Implementation

---

## 🚀 Quick Start Implementation Guide

### Recommended Approach: Option A (Simplest)

**Step 1: Update Client Dashboard** (`src/app/(site)/(users)/client/page.tsx`)

```tsx
// Around line 583, replace:
<Breadcrumb
  pageName="Client Dashboard"
  pageDescription="Manage your account"
/>;

// With:
const dashboardTitle =
  user.user_type === "VENDOR" ? "Vendor Dashboard" : "Client Dashboard";

<Breadcrumb pageName={dashboardTitle} pageDescription="Manage your account" />;
```

**Step 2: Update Vendor Page** (`src/app/(site)/(users)/vendor/page.tsx`)

```tsx
// Replace the entire file with a simple redirect:
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function VendorDashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Redirect to unified dashboard
  redirect("/client");
}
```

**Step 3: Test**

```bash
# Test as CLIENT user
pnpm run dev
# Login with client account → should see "Client Dashboard"

# Test as VENDOR user
# Login with vendor account → should see "Vendor Dashboard"
```

**Done!** 🎉 That's literally it. 5-minute implementation for a clean, maintainable solution.
