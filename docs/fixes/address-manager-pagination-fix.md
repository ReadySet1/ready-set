# Address Manager Pagination Fix

**Issue**: REA-110  
**Date**: October 6, 2025  
**Status**: ✅ Fixed  
**Severity**: Medium

## Problem Summary

The Address Manager page was showing "11 addresses in total" but only displaying 9 addresses, with no way to access the remaining 2 addresses. This created user confusion and prevented access to all saved addresses.

## Root Cause

The issue was in `src/components/AddressManager/UserAddresses.tsx` where the component wasn't properly using pagination data from the API response.

### Code Flow Analysis

1. **API Response** (Line 88-98):

   ```typescript
   const { data, isLoading, error, refetch } = useAddresses({
     filter: filterType,
     page: pagination.currentPage,
     limit: pagination.limit,
   });
   ```

2. **Data Extraction** (Line 100-102):

   ```typescript
   const addresses = data?.addresses || [];
   const paginationData = data?.pagination || pagination;
   ```

   - ✅ `paginationData` correctly gets API response data
   - ✅ Falls back to local `pagination` state if no data yet

3. **The Bug** (Line 346):
   ```typescript
   {!isLoading && pagination.totalPages > 1 && (
     // Pagination controls here
   )}
   ```

   - ❌ Uses local `pagination.totalPages` (always 1 - initial state)
   - ❌ Should use `paginationData.totalPages` (2 from API)

### Why It Failed

| Value                       | Source                    | Value | Result                     |
| --------------------------- | ------------------------- | ----- | -------------------------- |
| `pagination.totalPages`     | Local state (initialized) | `1`   | Pagination controls hidden |
| `paginationData.totalPages` | API response              | `2`   | Should show pagination     |

The local `pagination` state was initialized with default values and never updated, while `paginationData` contained the correct values from the API but wasn't being used in the conditional rendering.

## Solution

### Changes Made

**File**: `src/components/AddressManager/UserAddresses.tsx`  
**Lines**: 346-404

Replaced all instances of `pagination` with `paginationData` in the pagination section:

```diff
- {!isLoading && pagination.totalPages > 1 && (
+ {!isLoading && paginationData.totalPages > 1 && (
    <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row">
      <div className="text-sm text-gray-600 dark:text-gray-400">
-       Showing {(pagination.currentPage - 1) * pagination.limit + 1} -{" "}
+       Showing {(paginationData.currentPage - 1) * paginationData.limit + 1} -{" "}
        {Math.min(
-         pagination.currentPage * pagination.limit,
-         pagination.totalCount,
+         paginationData.currentPage * paginationData.limit,
+         paginationData.totalCount,
        )}{" "}
-       of {pagination.totalCount} addresses
+       of {paginationData.totalCount} addresses
      </div>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={handlePrevPage}
-             className={`${!pagination.hasPrevPage ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
+             className={`${!paginationData.hasPrevPage ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
            />
          </PaginationItem>

-         {[...Array(pagination.totalPages)].map((_, i) => (
+         {[...Array(paginationData.totalPages)].map((_, i) => (
            <PaginationItem key={i}>
              <PaginationLink
                onClick={() => handlePageChange(i + 1)}
-               isActive={pagination.currentPage === i + 1}
+               isActive={paginationData.currentPage === i + 1}
              >
                {i + 1}
              </PaginationLink>
            </PaginationItem>
          ))}

          <PaginationItem className="sm:hidden">
            <span>
-             {pagination.currentPage} of {pagination.totalPages}
+             {paginationData.currentPage} of {paginationData.totalPages}
            </span>
          </PaginationItem>

          <PaginationItem>
            <PaginationNext
              onClick={handleNextPage}
-             className={`${!pagination.hasNextPage ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
+             className={`${!paginationData.hasNextPage ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )}
```

## Technical Details

### API Pagination Structure

The `/api/addresses` endpoint returns:

```typescript
{
  addresses: Address[],
  pagination: {
    currentPage: number,    // Current page (1-indexed)
    totalPages: number,     // Math.ceil(totalCount / limit)
    totalCount: number,     // Total addresses matching filter
    hasNextPage: boolean,   // currentPage < totalPages
    hasPrevPage: boolean,   // currentPage > 1
    limit: number          // Items per page (9)
  }
}
```

### Pagination Calculation

For 11 addresses with 9 per page:

- `totalPages = Math.ceil(11 / 9) = 2`
- Page 1: Shows addresses 1-9
- Page 2: Shows addresses 10-11

## Expected Behavior After Fix

### Before Fix

- ❌ Shows "All (11)" but only displays 9 addresses
- ❌ No pagination controls visible
- ❌ Addresses 10-11 inaccessible

### After Fix

- ✅ Shows "All (11)" and displays 9 addresses on page 1
- ✅ Pagination controls visible at bottom
- ✅ "Showing 1-9 of 11 addresses" displayed
- ✅ Can click "Next" or "2" to see addresses 10-11
- ✅ All addresses accessible

## Testing

### Manual Testing Steps

1. **Setup**: Ensure user has 11+ addresses in database
2. **Navigate**: Go to `/addresses`
3. **Verify Initial State**:
   - ✅ See "All (11)" or higher in filter tab
   - ✅ See 9 address cards in 3x3 grid
   - ✅ See pagination controls at bottom
   - ✅ See "Showing 1-9 of X addresses"

4. **Test Navigation**:
   - ✅ Click "Next" button → Shows page 2
   - ✅ See remaining addresses (10-11 if total is 11)
   - ✅ "Previous" button becomes active
   - ✅ Click "1" → Returns to page 1

5. **Test Filters**:
   - ✅ Click "Private" → Shows only private addresses
   - ✅ Click "Shared" → Shows only shared addresses
   - ✅ Pagination adjusts based on filtered count

### Automated Testing

Existing tests in:

- `src/__tests__/components/AddressManager/UserAddresses.test.tsx`
- `src/__tests__/components/AddressManager/UserAddresses.infinite-loop.test.tsx`

Note: Some tests need QueryClientProvider wrapper (pre-existing issue, not related to this fix).

## Impact Assessment

### User Impact

- **Positive**: Users can now access all their saved addresses
- **UX**: Clear pagination controls improve navigation
- **Data Access**: No addresses are hidden from view

### Performance

- ✅ No performance impact
- ✅ API already returns correct pagination data
- ✅ Only UI rendering logic changed

### Breaking Changes

- ❌ None - This is a bug fix

## Related Files

- **Main Fix**: `src/components/AddressManager/UserAddresses.tsx`
- **API**: `src/app/api/addresses/route.ts` (already correct)
- **Hook**: `src/hooks/useAddresses.ts` (already correct)
- **Types**: `src/types/address.ts`

## Follow-up Items

1. **Test Coverage**: Update tests to include QueryClientProvider wrapper
2. **Documentation**: Update component documentation
3. **Monitoring**: Track if users are using pagination (analytics)

## Linear Issue

**Issue**: [REA-110](https://linear.app/ready-set-llc/issue/REA-110/address-manager-showing-incorrect-total-count-11-vs-9-displayed)  
**Status**: In Progress  
**Priority**: High  
**Team**: Ready Set LLC

---

**Fixed by**: AI Assistant  
**Reviewed by**: [Pending]  
**Deployed**: [Pending]
