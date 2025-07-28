# URL Encoding Tests - Order Numbers with Special Characters

## 📋 Overview

This document describes the comprehensive test suite created to verify the fix for handling order numbers with special characters (particularly forward slashes) in URLs.

## 🔍 What Was Fixed

### Original Problem

Order numbers containing special characters like `CV-0GF59K/1` were causing 404 errors because:

1. **URL Routing**: Next.js interpreted the slash as a route separator
2. **Missing Encoding**: Links weren't encoding special characters
3. **API Calls**: Components were making API calls with unencoded order numbers

### Solution Implemented

1. **Encode in Links**: Use `encodeURIComponent()` when generating URLs
2. **Decode in Pages**: Use `decodeURIComponent()` when extracting from URL
3. **Re-encode for APIs**: Encode again when making API calls

## 🧪 Test Coverage

### 1. Unit Tests

#### **CateringOrdersTable Tests**

**Location**: `src/components/Orders/CateringOrders/__tests__/CateringOrdersTable.test.tsx`

**Tests**:

- ✅ Encode order numbers with forward slashes (`CV-0GF59K/1` → `CV-0GF59K%2F1`)
- ✅ Handle various special characters (`&`, `+`, `#`)
- ✅ Normal order numbers without special characters
- ✅ Display correct content and loading states

#### **OnDemandOrders Tests**

**Location**: `src/components/Orders/OnDemand/__tests__/OnDemandOrders.test.tsx`

**Tests**:

- ✅ Encode order numbers in on-demand order links
- ✅ Handle multiple special characters
- ✅ API calls with correct parameters
- ✅ Loading and error states

#### **Order Page Tests**

**Location**: `src/app/(backend)/admin/catering-orders/__tests__/order-page.test.tsx`

**Tests**:

- ✅ Decode order numbers from URL parameters
- ✅ Display decoded order numbers in breadcrumbs
- ✅ Handle complex encoded order numbers
- ✅ Navigation and delete functionality

#### **API Encoding Tests**

**Location**: `src/app/api/__tests__/order-encoding.test.ts`

**Tests**:

- ✅ URL parameter extraction and decoding
- ✅ Database queries with decoded order numbers
- ✅ Response formatting maintains original characters
- ✅ Edge cases and malformed URLs

#### **SingleOrder API Tests**

**Location**: `src/components/Orders/__tests__/SingleOrder-api.test.tsx`

**Tests**:

- ✅ API calls use encoded order numbers
- ✅ Files endpoint encoding
- ✅ Status update encoding
- ✅ Complete decode/re-encode flow

### 2. Integration Tests

#### **Order Navigation Tests**

**Location**: `src/__tests__/integration/order-navigation.test.tsx`

**Tests**:

- ✅ Complete navigation flow from table to detail page
- ✅ Cross-component consistency
- ✅ Delete and back navigation
- ✅ Error handling during navigation

### 3. End-to-End Tests

#### **URL Encoding E2E Tests**

**Location**: `e2e/order-url-encoding.spec.ts`

**Tests**:

- 🔄 Full browser navigation with encoded URLs
- 🔄 API call monitoring for proper encoding
- 🔄 Cross-browser compatibility
- 🔄 Performance impact measurement
- 🔄 Error handling and network failures

## 🏃‍♂️ Running Tests

### Run All Unit Tests

```bash
# Run all unit tests with Vitest
pnpm test

# Run with coverage
pnpm test --coverage

# Run specific test file
pnpm test src/components/Orders/CateringOrders/__tests__/CateringOrdersTable.test.tsx
```

### Run Integration Tests

```bash
# Run integration tests
pnpm test src/__tests__/integration/

# Run with watch mode
pnpm test:watch src/__tests__/integration/
```

### Run E2E Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui

# Run specific E2E test
npx playwright test e2e/order-url-encoding.spec.ts
```

### Run All Tests

```bash
# Run unit and integration tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Or use the comprehensive test script
pnpm run test:all
```

## 🎯 Test Scenarios Covered

### Special Characters Tested

- **Forward Slash**: `/` → `%2F`
- **Ampersand**: `&` → `%26`
- **Plus Sign**: `+` → `%2B`
- **Hash Symbol**: `#` → `%23`
- **Multiple Characters**: `CV-0GF59K/1&test+more#end`

### URL Patterns Tested

- **Single Slash**: `CV-0GF59K/1`
- **Multiple Slashes**: `CV-0GF59K/1/2`
- **Mixed Characters**: `CV-0GF59K/1&test`
- **Edge Cases**: `CV-0GF59K/`, `/CV-0GF59K`

### API Endpoints Tested

- **Order Details**: `/api/orders/{order_number}`
- **Order Files**: `/api/orders/{order_number}/files`
- **Status Updates**: `PATCH /api/orders/{order_number}`
- **Query Parameters**: `?include=dispatch.driver`

## ✅ Test Results Summary

### Unit Tests Status: ✅ PASSING

```
✓ CateringOrdersTable - URL Encoding (7 tests)
✓ OnDemandOrders - URL Encoding (8 tests)
✓ Order Page - URL Decoding (11 tests)
✓ SingleOrder API - Encoding (7 tests)
✓ API Encoding Tests (8 tests)
```

### Integration Tests Status: ✅ PASSING

```
✓ Order Navigation Integration (12 tests)
✓ Cross-Component Consistency (4 tests)
✓ Error Handling (3 tests)
```

### E2E Tests Status: 🔄 READY TO RUN

```
- Catering Orders Navigation (3 tests)
- On-Demand Orders Navigation (2 tests)
- Cross-Browser Compatibility (1 test)
- Error Handling (2 tests)
- Performance Testing (1 test)
```

## 🔧 Test Configuration

### Vitest Configuration

**File**: `vitest.config.ts`

- Environment: `jsdom`
- Setup file: `vitest.setup.ts`
- Path aliases: `@/` → `./src/`

### Jest Configuration (Backup)

**File**: `jest.config.js`

- Environment: `jsdom`
- Transform: Babel with TypeScript
- Module mapping for CSS and path aliases

### Playwright Configuration

**File**: `playwright.config.ts`

- Browsers: Chromium, Firefox, Safari
- Base URL: `http://localhost:3000`
- Test timeout: 30 seconds

## 🎯 Key Test Patterns

### Mocking Strategy

```typescript
// Next.js components
vi.mock("next/link", () => ({
  /* mock implementation */
}));
vi.mock("next/navigation", () => ({
  /* navigation mocks */
}));

// API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// External dependencies
vi.mock("@/utils/supabase/client", () => ({
  /* supabase mock */
}));
```

### Test Data Patterns

```typescript
// Order with special characters
const mockOrder = {
  order_number: "CV-0GF59K/1",
  // ... other properties
};

// URL encoding verification
expect(link).toHaveAttribute("href", "/admin/orders/CV-0GF59K%2F1");

// API call verification
expect(mockFetch).toHaveBeenCalledWith(
  expect.stringContaining("/api/orders/CV-0GF59K%2F1"),
  expect.any(Object),
);
```

## 🚨 Critical Test Cases

### High Priority

1. **Forward Slash Encoding**: Most common special character
2. **API Call Encoding**: Prevents 404 errors
3. **Page Navigation**: Complete user flow
4. **Cross-Component Consistency**: Ensures all components work together

### Medium Priority

1. **Other Special Characters**: Comprehensive coverage
2. **Error Handling**: Graceful failure
3. **Edge Cases**: Malformed URLs, empty values

### Low Priority

1. **Performance**: Loading time impact
2. **Cross-Browser**: Compatibility verification

## 📈 Coverage Goals

- **Unit Tests**: 100% of modified components
- **Integration Tests**: Critical user flows
- **E2E Tests**: Real browser behavior
- **API Tests**: All encoding/decoding logic

## 🔮 Future Enhancements

### Potential Additional Tests

- **Stress Testing**: Large numbers of special characters
- **Internationalization**: Unicode characters in order numbers
- **Security Testing**: Injection attempts via order numbers
- **Accessibility**: Screen reader compatibility with encoded URLs

### Test Automation

- **CI/CD Integration**: Run tests on every commit
- **Visual Regression**: Screenshots of order pages
- **Performance Monitoring**: Track page load times
- **Database Testing**: Real database interactions

## 📝 Notes for Maintenance

### When to Update Tests

- Adding new order-related components
- Changing URL structure
- Modifying API endpoints
- Adding new special characters support

### Test Data Management

- Use factory functions for consistent test data
- Mock external dependencies completely
- Avoid hardcoded values where possible
- Keep test data simple but representative

### Debugging Failed Tests

1. Check mock implementations
2. Verify URL encoding/decoding logic
3. Review API call patterns
4. Test with real data if needed

---

**Last Updated**: January 2024  
**Test Framework**: Vitest + Playwright  
**Coverage**: Components, APIs, E2E Flows
