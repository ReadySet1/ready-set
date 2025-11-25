# API Test Failure Categorization Report
**Date:** 2025-11-10
**Last Updated:** Phase 5A (partial)
**Total API Tests:** 1,469 tests
**Passing:** 1,275 tests (86.8%)
**Failing:** 192 tests (13.1%)
**Skipped:** 2 tests (0.1%)

**Progress Tracking:**
- **Phase 4 Complete:** 86.2% (1,238/1,437 tests)
- **After status.test.ts fix:** 86.5% (1,242/1,437 tests)
- **After Phase 5A (partial):** 86.8% (1,275/1,469 tests) - +33 passing, +32 discovered

---

## 📊 Failure Categories

### Category 1: Test Suite Crashes / Module Errors (2 suites, ~30 tests)

**Priority:** HIGH (blocks entire test suites)

1. **api-security-qa.test.ts** - Missing `redis` module
   - **Error:** `Cannot find module 'redis'`
   - **Root Cause:** Test mocks redis module but it's not installed
   - **Fix:** Either install redis as dev dependency or remove the mock
   - **Impact:** Entire test suite fails to run

2. **orders-main.test.ts** - Jest worker crash
   - **Error:** `Jest worker encountered 4 child process exceptions, exceeding retry limit`
   - **Root Cause:** Unknown - requires investigation
   - **Fix:** Debug worker crash, possibly memory/timeout issue
   - **Impact:** Entire test suite fails to run

---

### Category 2: Mock Reference Errors (15 tests)

**Priority:** HIGH (easy fix, high impact)

**File:** `tracking/drivers.test.ts`
- **Error:** `ReferenceError: mockSupabaseClient is not defined`
- **Root Cause:** Test file has 13 references to `mockSupabaseClient` but never defines it
- **Background:** Route uses pg Pool, not Supabase. Test appears to be copy-pasted from Supabase test
- **Fix:** Remove all `mockSupabaseClient` references (tests should use mockPool instead)
- **Impact:** 15 test failures

**Failing Tests:**
1. filters drivers by status when status parameter provided
2. returns 400 for invalid status parameter
3. handles database errors gracefully
4. limits results when limit parameter provided
5. returns 400 for invalid limit parameter
6. creates a new driver successfully
7. handles database insertion errors
8. updates driver information successfully
9. returns 404 when driver not found
10. handles database update errors
11. requires authentication for all endpoints
12. requires admin role for write operations
13. allows read operations for authenticated users
14. handles malformed JSON in request body
15. handles network errors gracefully

---

### Category 3: Test Expectation Mismatches (20+ tests)

**Priority:** MEDIUM (requires route inspection)

#### 3a. Confirmation Message Regex Mismatch (1 test)
**File:** `user-purge.test.ts`
- **Error:** Expected: `/Request body with confirmation is required/i`, Received: `"Confirmation required. Set \"confirmed\": true in request body."`
- **Fix:** Update test regex to match actual message or update route message
- **Impact:** 1 test

#### 3b. Status Code Mismatches (8+ tests)
**Files:** Multiple
- **Pattern 1:** Expected 422, Received 200
  - Tests: cater-valley/orders-draft.test.ts (multiple tests)
  - **Root Cause:** Route returning success instead of validation error

- **Pattern 2:** Expected 422, Received 409
  - Tests: cater-valley/orders-update.test.ts
  - **Root Cause:** Route returning conflict instead of validation error

- **Pattern 3:** Expected 400, Received 200
  - Tests: tracking/drivers.test.ts (see Category 2)
  - **Root Cause:** Mock issue (see Category 2)

- **Pattern 4:** Expected 400, Received 500
  - Tests: tracking/drivers.test.ts - invalid JSON handling
  - **Root Cause:** Route's catch block returns 500 instead of 400 for JSON parse errors

#### 3c. Mock Call Expectations Not Met (5+ tests)
**Files:** cater-valley/orders-draft.test.ts
- **Error:** Expected Prisma calls not made
- **Examples:**
  - `prisma.user.upsert` not called with expected system user data
  - `prisma.cateringOrder.create` not called with expected order data
- **Root Cause:** Route logic may have changed or mocks not configured correctly

---

### Category 4: Authentication/Authorization Failures (25+ tests)

**Priority:** MEDIUM

**Files:** Multiple (file-uploads, auth/redirect, admin/make-super-admin, etc.)

**Common Patterns:**
1. **Tests expecting auth to fail are passing**
   - Example: user-purge.test.ts expects 400 for missing confirmation but route may not enforce

2. **Auth tests not mocking correctly**
   - Example: storage-cleanup.test.ts authentication service errors test

---

### Category 5: Response Structure / Data Format Issues (40+ tests)

**Priority:** MEDIUM-LOW

**Files:** Multiple (debug endpoints, health checks, vendor orders, etc.)

**Common Issues:**
1. **Missing response properties**
   - Example: debug.test.ts expects `body.error: "Could not parse body"` but receives empty object `{}`

2. **Unexpected response structure**
   - Tests expecting specific JSON structure receive different format

3. **Console logging expectations**
   - Example: Multiple tests checking for specific console.log patterns
   - Tests: calculator/calculate.test.ts, order/debug.test.ts, order/metrics.test.ts

---

### Category 6: Business Logic / Edge Case Failures (50+ tests)

**Priority:** LOW-MEDIUM (route-specific)

**Files:** Multiple

**Examples:**
1. **CaterValley order creation/update logic**
   - Tests: orders-draft.test.ts, orders-update.test.ts
   - Issues: System user creation, address handling, pricing calculations

2. **File upload validations**
   - Tests: file-uploads.test.ts, storage-upload.test.ts
   - Issues: Rate limiting, file type validation, size limits

3. **Health check degraded states**
   - Tests: health/health.test.ts
   - Issues: Storage config validation, database failure handling

4. **Catering request workflows**
   - Tests: catering-requests.test.ts
   - Issues: Address creation, email notifications, order number generation

5. **User deletion constraints**
   - Tests: userId-delete.test.ts
   - Issues: Active order checks, audit logging, transaction handling

---

### Category 7: Catch-All / 404 Route Tests (10+ tests)

**Priority:** LOW

**File:** `cater-valley/catch-all.test.ts`

**Issues:**
- Tests for unknown endpoints returning proper 404s with debugging info
- May be failing due to route registration issues or response format

---

## 🎯 Recommended Fix Order

### Phase 5A: High-Impact Quick Wins (30-40 tests)

1. ✅ **Fix tracking/drivers.test.ts** (17 tests) - **COMPLETED**
   - Removed all 13 `mockSupabaseClient` references
   - Updated to use `mockPool` correctly
   - Fixed response format expectations
   - **Result: 17/17 tests passing (was 0/17)**

2. ✅ **Fix api-security-qa.test.ts** (20 tests) - **PARTIAL FIX**
   - Removed redis mock (module no longer required)
   - **Result: 20/35 tests passing (was 0/35, blocking crash fixed)**
   - Remaining 15 failures are test-specific (Phase 5D)

3. **Fix orders-main.test.ts Jest crash** (1 suite)
   - Debug worker crash issue
   - Estimated time: 30-60 minutes

4. ✅ **Fix user-purge.test.ts regex** (1 test) - **COMPLETED**
   - Updated confirmation message regex to match actual route message
   - **Result: 30/30 tests passing (was 29/30)**

### Phase 5B: Status Code & Validation Fixes (20-30 tests)

5. **Audit 422 vs other status code mismatches**
   - Review cater-valley/orders-draft.test.ts expectations
   - Review cater-valley/orders-update.test.ts expectations
   - Estimated time: 45 minutes

6. **Fix JSON parse error handling**
   - Update routes to return 400 for JSON parse errors instead of 500
   - Estimated time: 20 minutes

### Phase 5C: Response Structure Fixes (40+ tests)

7. **Fix debug endpoint response formats**
   - cater-valley/debug.test.ts
   - order/debug.test.ts
   - Estimated time: 30 minutes

8. **Fix health check tests**
   - health/health.test.ts degraded state handling
   - Estimated time: 20 minutes

### Phase 5D: Business Logic Fixes (50+ tests)

9. **Fix CaterValley order workflows**
   - orders-draft.test.ts
   - orders-update.test.ts
   - Requires deep route logic review
   - Estimated time: 2-3 hours

10. **Fix file upload tests**
    - file-uploads.test.ts
    - storage-upload.test.ts
    - Estimated time: 1 hour

---

## 📈 Expected Impact

**Phase 5A:** +30-40 tests → **87.8% pass rate** (1,272-1,282 / 1,437)
**Phase 5B:** +20-30 tests → **89.2% pass rate** (1,292-1,312 / 1,437)
**Phase 5C:** +40 tests → **92.0% pass rate** (1,332 / 1,437)
**Phase 5D:** +50 tests → **96.1% pass rate** (1,382 / 1,437)

**Remaining after Phase 5:** ~55 tests (3.9% failure rate)

---

## 🔧 Files Requiring Updates

### Test Files (Fix Expectations):
1. `src/__tests__/api/tracking/drivers.test.ts` - Remove mockSupabaseClient
2. `src/__tests__/api/users/user-purge.test.ts` - Fix confirmation regex
3. `src/__tests__/api/api-security-qa.test.ts` - Fix redis module
4. `src/__tests__/api/orders/orders-main.test.ts` - Debug worker crash
5. `src/__tests__/api/cater-valley/orders-draft.test.ts` - Review expectations
6. `src/__tests__/api/cater-valley/orders-update.test.ts` - Review expectations
7. `src/__tests__/api/cater-valley/debug.test.ts` - Fix response expectations
8. `src/__tests__/api/health/health.test.ts` - Fix degraded state tests

### Route Files (Fix Implementation):
1. `src/app/api/tracking/drivers/route.ts` - JSON parse error handling
2. Multiple routes - Review 422 vs 400 status code usage
3. Debug endpoints - Review response structures

---

## 💡 Key Insights

1. **Mock Hygiene:** Many tests copied from other files still reference wrong mocks (mockSupabaseClient vs mockPool)

2. **Status Code Consistency:** Need standardization on when to return 400 vs 422 vs 500

3. **Error Message Patterns:** Test regexes should be more flexible to accommodate message improvements

4. **Infrastructure vs Logic:** Most failures are test expectations, not actual bugs

5. **Quick Wins Available:** 30-40 tests can be fixed in under 1 hour

---

## 📋 Next Steps

1. Start with Phase 5A (high-impact quick wins)
2. Run API tests after each fix to measure progress
3. Document patterns found during fixes
4. Update TESTING_PROGRESS.md after each phase
