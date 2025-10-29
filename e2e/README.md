# E2E Testing Documentation

## Overview

This directory contains end-to-end (E2E) tests for the Ready Set application using Playwright. The test suite has been optimized for performance and reliability as part of **REA-47: Phase 3 Integration & E2E Testing**.

## Performance Improvements

As part of REA-47, the E2E test suite has been dramatically optimized:

- **Execution Time**: Reduced from 20+ minutes → <5 minutes ⚡
- **Wait Optimization**: Replaced 17 `waitForTimeout` calls (40+ seconds) with proper wait conditions
- **Authentication**: Implemented session reuse via Playwright's `storageState`
- **CI Workers**: Increased from 1 → 2 workers for parallel execution
- **Browser Testing**: Optimized to run only Chromium in CI (all browsers locally)

## Quick Start

### Prerequisites

1. **Supabase Test Project**: Set up a separate Supabase project for testing
2. **Test Environment**: Copy `.env.test.example` to `.env.test` and configure
3. **Test Data**: Ensure test users exist in the database

### Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests in UI mode (helpful for debugging)
pnpm test:e2e:ui

# Run specific test file
pnpm playwright test e2e/client-dashboard.spec.ts

# Run tests in headed mode (see browser)
pnpm playwright test --headed

# Run only Chromium tests
pnpm playwright test --project=chromium
```

## Test Infrastructure

### Authentication

Tests use Playwright's `storageState` feature to reuse authentication sessions across tests. This eliminates the need for repeated login flows.

**How it works:**
1. Global setup (`e2e/auth/setup.ts`) runs once before all tests
2. Authenticates as each user role (CLIENT, VENDOR, ADMIN)
3. Saves session state to `e2e/.auth/*.json` files
4. Tests reuse these sessions via fixtures

**Using authenticated fixtures:**

```typescript
import { test, expect } from './fixtures/auth.fixture';

// Test as CLIENT
test.client('my test', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
  // Page is already authenticated as CLIENT
});

// Test as VENDOR
test.vendor('my test', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/vendor-dashboard');
  // Page is already authenticated as VENDOR
});

// Test with dynamic role
test.withRole('my test', async ({ authenticatedPage, role }) => {
  // role parameter can be passed via test.use({ role: 'ADMIN' })
}, { role: 'ADMIN' });
```

### Test Data

Test data is managed through:
- **Setup Script**: `e2e/test-data-setup.ts` creates test users and data
- **Test Users**:
  - `test-client@example.com` (CLIENT role)
  - `test-vendor@example.com` (VENDOR role)
  - Password: `TestPassword123!`

**Creating test data:**

```bash
# Setup test data
pnpm tsx e2e/test-data-setup.ts setup

# Cleanup test data
pnpm tsx e2e/test-data-setup.ts cleanup
```

## Test Organization

```
e2e/
├── .auth/              # Authenticated session files (gitignored)
├── auth/
│   └── setup.ts        # Global authentication setup
├── fixtures/
│   └── auth.fixture.ts # Authentication fixtures
├── utils/
│   └── test-helpers.ts # Shared test utilities
├── *.spec.ts           # Test files
└── README.md           # This file
```

### Current Test Files (13)

1. `address-county-selection.spec.ts` - County selection validation
2. `admin-flow.spec.ts` - Admin dashboard navigation
3. `auth-flow.spec.ts` - Authentication UI flows
4. `bug-fixes-integration.spec.ts` - Bug regression tests
5. `order-flow.spec.ts` - Order creation flows
6. `order-url-encoding.spec.ts` - Special character handling
7. `user-edit-workflow.spec.ts` - User CRUD operations
8. `addresses-infinite-loop.spec.ts` - Performance regression test
9. `client-dashboard.spec.ts` - Client dashboard QA
10. `data-separation.spec.ts` - Role-based access control
11. `vendor-dashboard.spec.ts` - Vendor dashboard QA
12. `softDelete.spec.ts` - User soft delete flows
13. `test-data-setup.ts` - Database seeding script

## Writing Tests

### Best Practices

1. **Use Proper Wait Conditions**
   ```typescript
   // ❌ Bad: Arbitrary timeout
   await page.waitForTimeout(2000);

   // ✅ Good: Wait for specific condition
   await page.waitForLoadState('networkidle');
   await page.waitForSelector('[data-testid="content"]');
   await page.waitForResponse(response => response.url().includes('/api/'));
   ```

2. **Use Authenticated Fixtures**
   ```typescript
   // ❌ Bad: Manual login in every test
   await page.goto('/sign-in');
   await page.fill('[name="email"]', 'test@example.com');
   // ...

   // ✅ Good: Use fixture
   test.client('my test', async ({ authenticatedPage }) => {
     // Already authenticated!
   });
   ```

3. **Use Data Test IDs**
   ```typescript
   // ❌ Bad: Brittle selector
   await page.click('button.bg-blue-500.text-white');

   // ✅ Good: Stable selector
   await page.click('[data-testid="submit-button"]');
   ```

4. **Write Isolated Tests**
   ```typescript
   // Each test should be independent
   test('test 1', async ({ page }) => {
     // Setup, execute, cleanup within test
   });

   test('test 2', async ({ page }) => {
     // Don't depend on test 1's state
   });
   ```

## Configuration

### Playwright Config

The Playwright configuration (`playwright.config.ts`) includes:

- **Global Setup**: Runs authentication setup before all tests
- **Parallel Execution**: Tests run in parallel (fully parallel locally, 2 workers on CI)
- **Timeouts**: Reduced to 15s for actions and navigation
- **Browsers**: All browsers locally, Chromium only on CI
- **Retries**: 1 retry on CI (reduced from 2 for speed)

### Environment Variables

Required environment variables (`.env.test`):

```env
# Supabase Test Project
NEXT_PUBLIC_SUPABASE_URL=https://your-test-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-test-anon-key

# Database
DATABASE_URL=postgresql://user:password@host:5432/database
```

## CI/CD Integration

E2E tests run automatically in CI on:
- Pull requests to `main` or `development`
- Pushes to `main` or `development`

**CI Optimizations:**
- Runs only Chromium (fastest browser)
- Uses 2 parallel workers
- 10-minute timeout (down from 20 minutes)
- Uploads test reports and screenshots on failure

**GitHub Secrets Required:**
- `TEST_DATABASE_URL` - Database connection string for test project
- `TEST_SUPABASE_URL` - Supabase test project URL
- `TEST_SUPABASE_ANON_KEY` - Supabase test project anon key

## Troubleshooting

### Authentication Issues

**Problem**: Tests fail with "Auth file not found" error

**Solution**:
```bash
# Run authentication setup manually
pnpm playwright test --project=setup

# Or delete old auth files and re-run
rm -rf e2e/.auth
pnpm test:e2e
```

### Test Timeouts

**Problem**: Tests timeout waiting for elements

**Solutions**:
1. Check if test data exists (run `pnpm tsx e2e/test-data-setup.ts setup`)
2. Verify Supabase test project is running
3. Check network connectivity
4. Increase timeout for specific assertion: `await expect(element).toBeVisible({ timeout: 10000 })`

### Flaky Tests

**Problem**: Tests pass locally but fail in CI

**Common Causes**:
1. **Race conditions**: Add proper wait conditions
2. **Test data issues**: Ensure data is created before test runs
3. **Timing differences**: CI is slower, adjust timeouts if needed
4. **Browser differences**: Test locally with Chromium to match CI

### Database Issues

**Problem**: Tests fail with database connection errors

**Solutions**:
1. Verify `DATABASE_URL` in `.env.test` is correct
2. Check Supabase test project is active
3. Run migrations on test database
4. Ensure test users exist (run setup script)

## Future Enhancements

Planned improvements for E2E testing (subsequent PRs):

1. **PR #2: Error Scenarios & Recovery** (5-7 new tests)
   - Network failures and recovery
   - Invalid form submissions
   - Session timeout handling
   - Permission denied scenarios

2. **PR #3: Search & Filtering** (5-7 new tests)
   - Global search functionality
   - Advanced filtering combinations
   - Sorting capabilities
   - Filter persistence

3. **PR #4: File Upload/Download** (3-5 new tests)
   - File upload in various forms
   - Document management (50MB limit)
   - File validation (size, type)
   - Download functionality

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [REA-47 Plane Issue](https://plane.readysetllc.com/ready-set-llc/browse/REA-47)

## Support

For questions or issues with E2E tests:
1. Check this README
2. Review test examples in existing spec files
3. Consult Playwright documentation
4. Ask in team chat or create a Plane issue
