# CaterValley Reference Documentation - Important Notes

**⚠️ CRITICAL: Read This Before Using Reference Files**

## The Problem

Several reference files exist that show **INCORRECT** field names and schemas:

**Location:** `/Users/ealanis/Downloads/files/`

**Files with Outdated Information:**
- `api-draft-route.ts`
- `api-routes-full.ts`
- `types-catervalley.ts`
- `catervalley-integration-spec.md`

---

## ❌ What These Files Show (INCORRECT)

```typescript
// WRONG - Do NOT use this schema
interface DraftOrderRequest {
  deliveryAddress: Address;      // ❌ We use "dropOffLocation"
  items: OrderItem[];            // ❌ We don't track items array
  headCount?: number;            // ❌ We use required "totalItem"
  deliveryDate?: string;         // ❌ deliveryDate is REQUIRED in our API
}
```

---

## ✅ What Our ACTUAL Production API Uses (CORRECT)

```typescript
// CORRECT - This is what we actually use
interface DraftOrderRequest {
  dropOffLocation: Location;     // ✅ NOT "deliveryAddress"
  totalItem: number;             // ✅ Required headcount, NOT "headCount"
  // NO items array                ✅ We don't track individual items
  deliveryDate: string;          // ✅ REQUIRED, not optional
}
```

**👉 See:** `/docs/catervalley/API_CONTRACT.md` for the canonical specification

---

## Why The Discrepancy Exists

### Theory 1: Outdated Planning Documents
These files may be from early planning stages before the actual implementation was finalized.

### Theory 2: Generic Examples
The files might be generic examples from a naming conventions guide, not actual specifications.

### Theory 3: Different Integration Spec
These could describe a different API integration entirely, not related to CaterValley.

---

## What We Verified

### ✅ Production Database Check (Nov 10, 2025)

**Query:** All orders with `orderNumber` LIKE 'CV-%'

**Results:** 20 CaterValley orders found
- **Date Range:** Oct 27, 2025 - Nov 5, 2025
- **Status:** All successfully processed
- **Data Structure:** Confirms our implementation is correct

**Sample Order:**
```json
{
  "orderNumber": "CV-CV-20251027114646-5125",
  "brokerage": "CaterValley",
  "headcount": 31,          // Maps from "totalItem"
  "orderTotal": "100.00",   // Maps from "priceTotal"
  "status": "ACTIVE"
}
```

### ✅ Code Review (Nov 10, 2025)

**Files Checked:**
- `/src/app/api/cater-valley/orders/draft/route.ts`
- `/src/app/api/cater-valley/orders/update/route.ts`
- `/src/app/api/cater-valley/orders/confirm/route.ts`
- `/src/app/api/cater-valley/_lib/pricing-helper.ts`

**Findings:** All code consistently uses:
- `dropOffLocation` (NOT `deliveryAddress`)
- `totalItem` as required field
- No `items[]` array
- `deliveryDate` as required

### ✅ Test Coverage (Nov 10, 2025)

**Test File:** `/src/__tests__/api/cater-valley/orders-draft.test.ts`

**Results:** All 15 CaterValley tests passing
- Tests use correct `dropOffLocation` schema
- Tests verify required `totalItem` and `deliveryDate` fields
- No tests reference `deliveryAddress` or `items[]`

---

## Email Conversation Analysis

**Participants:** Emmanuel (ReadySet) ↔ Halil/Ugras (CaterValley)

**Key Timeline:**
- **May 2025:** Integration discussion started
- **May 5, 2025:** Halil provided payload examples (attachments not recovered)
- **May 28, 2025:** Emmanuel confirmed endpoints working
- **June 23, 2025:** Timezone issue discovered and fixed
- **July 3, 2025:** Discount system implemented
- **July 9, 2025:** Integration went live
- **Nov 5, 2025:** Pricing issue reported ($35 vs $42.50)

**Important:** No mention in emails about field name mismatches or integration failures due to incorrect schema.

**Conclusion:** If there was ever a `deliveryAddress` version, it was changed before production deployment.

---

## What To Do

### ✅ DO THIS

1. **Use the canonical documentation:**
   - `/docs/catervalley/API_CONTRACT.md`

2. **Reference the actual code:**
   - `/src/app/api/cater-valley/` (production routes)

3. **Check test files for examples:**
   - `/src/__tests__/api/cater-valley/`

4. **Query production database for real data:**
   - Table: `catering_requests`
   - Filter: `brokerage = 'CaterValley'`

### ❌ DON'T DO THIS

1. **Don't trust the reference files in `/Users/ealanis/Downloads/files/`**
   - They show an outdated/incorrect schema

2. **Don't use `deliveryAddress` in new code**
   - Our API expects `dropOffLocation`

3. **Don't make `deliveryDate` or `totalItem` optional**
   - They are required in our implementation

---

## Field Name Mapping Reference

| Reference Docs (WRONG) | Production API (CORRECT) | Notes |
|------------------------|-------------------------|-------|
| `deliveryAddress` | `dropOffLocation` | Main delivery location object |
| `items: OrderItem[]` | NOT USED | We only track totalItem + priceTotal |
| `headCount?: number` | `totalItem: number` | Required, not optional |
| `deliveryDate?: string` | `deliveryDate: string` | Required, not optional |

---

## Production Validation

### Order CV-B4ARH0/1 (Nov 5, 2025)

This was the order that prompted the $35 pricing issue email from Ugras:

```json
{
  "orderNumber": "CV-B4ARH0/1",
  "brokerage": "CaterValley",
  "status": "CANCELLED",
  "orderTotal": "19.00",
  "headcount": 1,
  "arrivalDateTime": "2025-11-07 19:45:00+00",
  "createdAt": "2025-11-05 17:44:44.486+00",
  "updatedAt": "2025-11-05 18:19:06.843+00"
}
```

**Analysis:**
- $19 food cost + 1 headcount → Tier 1 pricing
- **Before fix:** Calculated ~$35 (below minimum)
- **After fix (commit e61eb38):** Enforces $42.50 minimum
- Order was cancelled 35 minutes after creation

**Resolution:** Fixed in commit `e61eb38` on Nov 10, 2025

---

## When To Update This Document

Update this file if you discover:

1. **New reference files** with incorrect schemas
2. **Email attachments** from May 2025 conversation (currently missing)
3. **Old API versions** that used different field names
4. **Migration history** explaining the field name changes

---

## Questions?

**Technical Questions:**
- Emmanuel Alanis: ealanis@readysetllc.com

**CaterValley Integration:**
- Halil Han Badem (CTO): halil@catervalley.com
- Ugras Bassullu: ugras@catervalley.com

---

## Last Updated

**Date:** 2025-11-10
**Updated By:** Claude Code (AI Assistant)
**Reason:** Production database analysis confirmed schema discrepancy
