# Calculator Features Roadmap

**Created**: 2026-04-11
**Last Updated**: 2026-04-11 (implementation complete)
**Branch**: `fix/pre-merge-audit-security`

---

## Overview

Three enhancements to the Delivery Calculator system at `/admin/calculator`:

| # | Feature | Status | Priority |
|---|---------|--------|----------|
| 1 | [Net Profit Field](#feature-1-net-profit-field) | Done | High |
| 2 | [Drive Time Fields](#feature-2-drive-time-fields) | Done | High |
| 3 | [Vendor UI Gaps](#feature-3-vendor-ui-for-calculator) | Partial (Gaps 1,2,4 done) | Medium |

---

## Feature 1: Net Profit Field

**Goal**: Show net profit (Ready Set Earnings - Driver Pay) in the Results tab of the calculator.

**Problem**: Profit is currently only visible in the History tab as `customerTotal - driverTotal`. The user needs to see Ready Set's actual take-home per delivery in real-time.

**Formula**: `Net Profit = Total Ready Set Fee - Total Driver Pay`

### Scope
- Add `netProfit` useMemo derived from existing `readySetEarnings` and `result.driverPayments.total`
- Add full-width summary card in Results tab with:
  - Ready Set Earnings total
  - Driver Pay total
  - Net Profit (color-coded: green positive, red negative)
  - Profit margin percentage

### Files Modified
- `src/components/calculator/DeliveryCalculator.tsx`

### Status: Done
- Added `netProfit` useMemo and full-width summary card in `DeliveryCalculator.tsx`

---

## Feature 2: Drive Time Fields

**Goal**: Add pickup/dropoff address fields and a date+time picker to the calculator Input tab for traffic-aware mileage auto-calculation.

**Problem**: Mileage is entered manually. The mileage calculator page already supports traffic-aware routing via Google Directions API (`departureTime` parameter) but is disconnected from the delivery cost calculator.

### Scope
- Toggle between "Enter mileage manually" and "Calculate from addresses"
- Address mode provides:
  - Pickup address input (reuses `LocationInput` component)
  - Dropoff address input
  - Date + Time picker for departure (enables traffic estimates for specific day/time)
  - "Calculate Route" button
- Auto-populates mileage field from Google API response
- Shows estimated drive time in Results tab

### Key Decision
- **Date + Time picker** selected (not date-only) to allow traffic-aware estimates for specific times (e.g., Monday 11:30 AM vs Friday 5:00 PM)

### Files Modified
- `src/types/calculator.ts` -- add optional address/time fields
- `src/components/calculator/DeliveryCalculator.tsx` -- address mode UI and route calculation

### Dependencies
- Existing `/api/routes/optimize` endpoint (already supports `departureTime`)
- Existing `LocationInput` component from `src/components/RouteOptimizer/LocationInput.tsx`

### Status: Done
- Added address mode toggle, LocationInput components, datetime-local picker, and `calculateMileageFromAddresses` function in `DeliveryCalculator.tsx`

---

## Feature 3: Vendor UI for Calculator

**Goal**: Review and fix gaps in the existing templates/vendor configuration system.

**What Already Works**:
- `ClientConfigurationManager.tsx` -- full CRUD UI with 4 tabs
- Settings page at `/admin/calculator/settings`
- API endpoints for configurations CRUD
- Clone, export/import JSON functionality
- 6 pre-built client configurations (Ready Set Food Standard, Kasa, CaterValley, Try Hungry, HY Food Company Direct, Ready Set Food Premium)

### Identified Gaps

| Gap | Description | Fix | Priority |
|-----|-------------|-----|----------|
| 1 | No "Create New" flow (only clone) | Add "Create New Configuration" button with defaults | High | Done |
| 2 | Delete confirmation not wired up | Wire up existing `showDeleteConfirm` state to dialog | High | Done |
| 3 | Tier config saves to localStorage, not DB | Route saves through configurations API | Medium | Not Started |
| 4 | `zeroOrderSettings` not persisted to DB | Add to `configToDb` mapping in API route | Medium | Done |
| 5 | No driver base pay tiers UI | Add "Advanced Driver Pay Tiers" section | Low | Not Started |
| 6 | No zero-order settings UI | Add "Zero Order Settings" section | Low | Not Started |

### Files Modified
- `src/components/calculator/ClientConfigurationManager.tsx` -- Gaps 1, 2, 5, 6
- `src/components/calculator/CalculatorRuleEditor.tsx` -- Gap 3
- `src/app/api/calculator/configurations/route.ts` -- Gap 4

### Status: Partial
- Done: Gaps 1 (Create New button), 2 (Delete confirmation dialog), 4 (zeroOrderSettings persistence)
- Remaining: Gaps 3, 5, 6

---

## Implementation Order

1. **Feature 1** (Net Profit) -- smallest scope, immediate value
2. **Feature 2** (Drive Time) -- medium scope, builds on existing APIs
3. **Feature 3** (Vendor UI) -- largest scope, incremental gap fixes

## Verification Checklist

- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes (no new warnings)
- [x] `pnpm test` passes (352 suites, 7684 tests)
- [ ] Manual test: `/admin/calculator` shows net profit card
- [ ] Manual test: address mode calculates mileage with traffic awareness
- [ ] Manual test: `/admin/calculator/settings` CRUD operations work
