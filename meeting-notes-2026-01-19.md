# Weekly Meeting Notes - Week of Jan 13-19, 2026

## Current Branch
`feature/order-tracking-driver-vendor-flows`

---

## Completed This Week

### Real-time Driver Location Tracking
- Implemented Supabase Realtime for live driver tracking (a69d73b)
- Created vendor-accessible driver location API endpoint (ff94d2d)
- Added driver location tracking to order status page (5708a3d)
- Fixed UUID casting and improved polling frequency (1a003b5, 5c0f98d)

### Order Management Improvements
- Added mini map to order details for helpdesk visibility - REA-307 (468df54)
- Added admin order editing with customer notifications (26a28a6)
- Added pickup and delivery times to order dashboard (cec10fe)
- Fixed timezone formatting in EditOrderDialog (3787167)
- Block past dates in order creation date pickers (3c10b92)

### Driver Portal
- Added driver stats aggregation with delivery/distance data - REA-306 (17c3b64)
- Limited dashboard historical data to 30 days - REA-305 (286df97)
- Fixed driver name mismatch and simulator driver selection (1b87591)

### Calculator & Pricing
- Added delivery cost estimator to order forms - REA-309 (52ed51a)
- Updated CaterValley driver pay configuration (ff5df85)
- Implemented Destino driver compensation rules (82f37a8)

### Test Coverage - REA-275
- Added component testing infrastructure for React pages (5a3b4dd)
- Added driver portal page tests (f2ab8ef)
- Added calculator unit/integration tests (22ddc59, eb6ef85)
- Updated CI test threshold to 95% (b6ca024)
- Fixed 120+ failing tests for tracking refactor (56b25e7)

### Bug Fixes
- Fixed account information form save failure - REA-147 (64677d3)
- Fixed iOS Safari location tracking - REA-304 (c355f44)
- Security: replaced Math.random() with crypto.getRandomValues() (53feb6f)
- Fixed partner logo alignment (a8f2239)

---

## PRs Merged
| PR | Description |
|----|-------------|
| #276 | Test coverage improvements (REA-275) |
| #275 | Mini map for order details (REA-307) |
| #274 | CI threshold update to 95% |
| #273 | Account tab save fix (REA-147) |
| #267 | CaterValley vendor configuration |
| #266 | Calculator UI testing (REA-40) |
| #265/264/263 | Driver data limits and admin edit orders |
| #261 | Safari iOS location tracking fix (REA-304) |

---

## In Progress
- Order tracking driver/vendor flows (current branch)

## Upcoming
| Issue | Description | Priority |
|-------|-------------|----------|
| REA-310 | Test single drive tracking with real locations | High |
| REA-311 | Test multi-stop route tracking | Medium |
| REA-312 | Real-time order notifications for admin dashboard | Medium |
| REA-313 | Implement data archiving strategy | Medium |

---

## Stats
- **Commits this week**: 50+
- **Files changed**: 40+
- **Lines added**: ~8,200

---

## Dev Team Meeting Topics - Implementation Status

### Data Archiving & Performance
| Requirement | Status | Notes |
|-------------|--------|-------|
| Limit active data to ~30 days | ⚠️ Partial | Driver dashboard limited to 30 days (286df97), but no global archival |
| Rolling archival for driver/order data | ❌ Not implemented | Soft-delete cleanup exists (90-day GDPR retention) but no archival |
| PDF/export for archived driver history | ❌ Not implemented | No PDF export functionality in codebase |

**Key file**: `/src/jobs/cleanupSoftDeleted.ts` - handles permanent deletion after 90 days

### Notifications & Real-Time UX
| Requirement | Status | Notes |
|-------------|--------|-------|
| Vendor orders appear in real-time on admin | ❌ Not implemented | Tracked as REA-312 |
| Auto-refresh active orders | ✅ Implemented | Admin tracking dashboard has auto-refresh toggle |
| Real-time notification service for new orders | ❌ Not implemented | Realtime exists for driver tracking, not order creation |

**Key files**:
- `/src/lib/realtime/client.ts` - Full Supabase Realtime client
- `/src/hooks/tracking/useAdminRealtimeTracking.ts` - Admin dashboard tracking

### Mileage & Route Logic
| Requirement | Status | Notes |
|-------------|--------|-------|
| Automatic mileage via Google Maps API | ⚠️ Different approach | Uses **PostGIS** for GPS-based calculation, not Google Maps |
| Route deviation warnings | ❌ Not implemented | Technically possible but not prioritized |
| Multi-stop mileage calculation | ⚠️ Partial | Per-delivery breakdown exists, no route optimization |

**Key file**: `/src/services/tracking/mileage.ts` - GPS distance with quality filters

### Vendor & On-Demand Orders
| Requirement | Status | Notes |
|-------------|--------|-------|
| Vendor dashboard with order status tabs | ⚠️ Partial | Vendor redirects to `/client` dashboard |
| Catering order creation | ✅ Implemented | Admin CRUD + CaterValley integration |
| On-demand orders | ✅ Implemented | Full functionality for admin and client |

**Key files**:
- `/src/app/api/vendor/orders/route.ts`
- `/src/app/(backend)/admin/catering-orders/page.tsx`
- `/src/app/(backend)/admin/on-demand-orders/page.tsx`

### Recommended Next Actions
1. **REA-312**: Add real-time order creation notifications to admin dashboard
2. **REA-313**: Implement rolling data archival (beyond current soft-delete)
3. Create dedicated vendor dashboard with status filter tabs
4. Add PDF export for driver history reports

---

## Follow-up from Jan 12 Meeting

### Action Items Status
| Action Item | Status | Notes |
|-------------|--------|-------|
| Fix Safari location issue (iOS) | ✅ Done | REA-304 (c355f44) |
| Driver dashboard: 30 days historical data | ✅ Done | REA-305 (286df97) |
| Link deliveries/distance with driver stats | ✅ Done | REA-306 (17c3b64) |
| Add mini map to order details for helpdesk | ✅ Done | REA-307 (468df54) |
| Route deviation warning | ❌ Deprioritized | Not a current priority per both meetings |
| Test single drives with real locations | 🔄 In Progress | REA-310 - scheduled for this week |
| Test multiple drives/stops | 🔄 Pending | REA-311 - scheduled after single drive testing |

### Items Not Yet Addressed
| Item | Description | Status |
|------|-------------|--------|
| James' platform walkthrough | Demo scheduled for Jan 19 to show how features can be interchanged for new website builds | ❓ Pending confirmation |
| Calculator on vendor dashboard | Integrate cost calculator for vendors to get delivery estimates during order creation | ⚠️ Partial - delivery cost estimator added to order forms (52ed51a), vendor-specific integration TBD |
| Restaurant addresses from Cool Fire | All addresses imported to make address entry easier | ❓ Needs verification |

### Discussion Points to Revisit
- **Data archiving strategy**: Gary suggested 30 days readily accessible, archive older data weekly after 5 weeks, PDF access for drivers
- **Mileage clarification**: Currently using PostGIS (GPS-based), not Google Maps API as discussed - confirm if this meets requirements
- **On-demand orders**: Mark and Gary noted as important for business - currently implemented but testing focused on basic food orders first

---

## Emmanuel's Updates for This Week

### Questions for Team
- **Destino work**: Have ~5 hours of pending work for Destino. Can we add those hours this week?

### Schedule Changes
- **Mobile tracking testing**: Real testing with mobile browser delayed to next week (was scheduled for this week per REA-310)

### Pending Validations
- **Calculator cost**: Updated and waiting on Fernando's results to verify calculations are correct
  - Reference: Master upload sheet file
  - Related commit: 52ed51a (delivery cost estimator)
