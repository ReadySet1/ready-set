# Skipped Tests Analysis - REA-292

**Date**: 2026-01-06
**Branch**: `feature/REA-292-enable-skipped-tests`
**Current Status**: 658 skipped tests, 4646 passed (87.6% pass rate)

## Summary

This document categorizes all skipped tests and their reasons. Most skipped tests require actual code fixes or complex mock improvements, not just test adjustments.

## Tests Enabled in This Sprint

| File | Tests Enabled | Fix Applied |
|------|---------------|-------------|
| `src/lib/__tests__/cache.test.ts` | 7 | Fixed cache TTL assertions |
| `src/components/__tests__/ConditionalRenderingPatterns.test.tsx` | 2 | Fixed async state assertions |
| `src/lib/__tests__/spam-protection.test.ts` | 7 | Fixed XSS pattern detection + bug fix |
| `src/__tests__/components/Common/Breadcrumb.responsive.test.tsx` | 13 | Fixed class assertions |
| `src/components/Pricing/__tests__/ModernPricingLandingPage.test.tsx` | 1 | Added Cloudinary mock |
| `src/components/Orders/__tests__/OrderStatus-RoleBased.test.tsx` | 18 | Fixed status display format (ACTIVE -> Active) |
| **Total** | **48** | |

## Skipped Tests by Issue Reference

### REA-211: Implementation Logic Differences
Tests skipped because the implementation logic differs from test expectations. Requires code changes.

| File | Skipped Tests | Reason |
|------|---------------|--------|
| `calculator-fix-verification.test.ts` | 4 | Driver pay calculation includes mileage differently |
| `redirect.test.ts` | 1 | Implementation allows any localhost port |
| `enhanced-file-upload.test.ts` | 5 | FileValidator behavior differs from expectations |
| `custom-seo.test.tsx` | 14 | next/head mocking issues |
| `email.test.ts` | 10+ | Circuit breaker state persistence issues |

### REA-261: Mock Response Parsing
Tests skipped due to mock Response JSON parsing issues in test setup.

| File | Skipped Tests | Reason |
|------|---------------|--------|
| `dashboard-metrics/route.test.ts` | 3 | Cache data mock setup issues |

### REA-262: Complex Component Mocking
Tests require extensive mocking of UI libraries (lucide-react icons, shadcn components).

| File | Skipped Tests | Reason |
|------|---------------|--------|
| `OrderPage.test.tsx` | 12+ | VendorPage pagination needs icon mocking |

### REA-266: Timing/Debounce Issues
Tests fail due to component debounce/timing behavior in test environment.

| File | Skipped Tests | Reason |
|------|---------------|--------|
| `AddressManager/index.test.tsx` | 3 | Refresh callback timing issues |

### REA-269: AddressManager Mock Integration
Tests need proper AddressManager mock that simulates full callback flow.

| File | Skipped Tests | Reason |
|------|---------------|--------|
| `CateringOrderForm.test.tsx` | 1 | Address selection callback not properly mocked |
| `CreateCateringOrderForm.test.tsx` | 3 | Same issue with address auto-selection |

### REA-281: Multi-API Mock Setup
Tests require comprehensive mock setup for multiple concurrent API calls.

| File | Skipped Tests | Reason |
|------|---------------|--------|
| `SingleOrder-api.test.tsx` | 50+ (4 describe blocks) | Multiple API endpoints need mocking |

### Other Issues

| Category | Files Affected | Est. Tests |
|----------|----------------|------------|
| Integration tests with complex setup | 10+ files | 100+ |
| Real-time/WebSocket mocking | `client.test.ts`, `tracking-system.test.tsx` | 30+ |
| Auth flow testing | `login.test.ts`, `token-refresh-and-session.test.ts` | 50+ |
| Database mocking | `order.test.ts`, `drivers.test.ts` | 40+ |

## Recommendations

### Quick Wins (Can be fixed with test changes only)
- Most quick wins have been addressed in this sprint

### Medium Effort (Require mock improvements)
1. **Dashboard metrics tests** - Fix mock Response setup
2. **AddressManager tests** - Create shared mock helper
3. **CateringOrderForm tests** - Extend AddressManager mock

### High Effort (Require code changes)
1. **Calculator tests** - REA-211 needs business logic review
2. **Email resilience tests** - Circuit breaker implementation review
3. **Realtime client tests** - Supabase WebSocket mocking

### Consider Removing
Some test files may be testing implementation details rather than behavior:
- Very granular unit tests that duplicate integration coverage
- Tests for deprecated code paths

## Pass Rate Tracking

| Date | Passed | Skipped | Total | Pass Rate |
|------|--------|---------|-------|-----------|
| Start | 4626 | 677 | 5303 | 87.2% |
| Current | 4646 | 658 | 5304 | 87.6% |
| Target | ~5041 | <263 | 5304 | 95% |

## Next Steps

1. Create shared mocking utilities for common patterns:
   - AddressManager mock helper
   - Supabase auth mock helper
   - API response mock builder

2. Review tests marked for removal/refactoring

3. Address REA-211 implementation issues through proper tickets
