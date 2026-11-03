# Order timezone per location

Card: `order-timezone-per-location` (critical). Follow-up to #658 / #667 / #685, which pinned
order times to `TIMEZONE_CONFIG.LOCAL_TIMEZONE` (Pacific). This step makes the zone follow the
order's location so an Austin order entered as 11:00 is stored and shown as 11:00 CT.

## Where the zone lives

- New nullable column `addresses.timezone` (IANA name, e.g. `America/Chicago`).
- Written at the order-entry paths (admin create actions, order PATCH address upsert, `/api/addresses`).
  Other address writers (register, CaterValley, profile) leave it `NULL`; that is safe because
  resolution below never depends on the column being set.
- A stored value wins over derivation, which leaves room for a manual override later.

## How it is derived

`src/lib/utils/address-timezone.ts`, pure and unit-tested:

1. `address.timezone` when present.
2. ZIP prefix table (first 3 digits of the 5-digit ZIP): CA → `America/Los_Angeles`;
   TX → `America/Chicago`, except El Paso / Hudspeth (798, 799, 885) → `America/Denver`;
   GA → `America/New_York`. Ranges are a plain array, so adding a state is one line.
3. Coordinates fallback when the ZIP is unknown: coarse CONUS longitude bands
   (Pacific / Mountain / Central / Eastern). Approximate by design; only reached for ZIPs
   outside the table.
4. `TIMEZONE_CONFIG.LOCAL_TIMEZONE` (Pacific).

`addresses.state` is not consulted: it is dirty free text on prod.

## Order zone

`orderTimezone(order) = resolve(order.pickupAddress)`, Pacific fallback. Pickup, not delivery,
because the pickup time is what the restaurant and driver act on. Cross-zone orders
(pickup in El Paso, delivery in Austin) are not a live scenario; both times use the pickup zone.

## Input

- Edit dialog (`EditOrderDialog`): the existing `setZonedDate` / `setZonedTime` / `zonedCalendarDay`
  helpers take the order zone instead of the default; the time label reads `Time (CT)` / `Time (PT)`.
- Create forms (catering, on-demand): today the pickers build a `Date` from the browser's clock, so
  the typed wall-clock is interpreted in the viewer's zone. On submit the wall-clock components are
  re-read in the pickup address zone (`reinterpretWallClock`). A "Times in CT" hint next to the
  pickup picker shows that zone before submit. A CA admin typing 11:00 for an Austin
  order now stores 16:00Z (11:00 CDT), and a viewer outside Pacific no longer skews CA orders.
- API partners (CaterValley, CaterCow) keep their current parsing: their contracts define the zone
  they send. Not touched here.

## Display

`formatDateTimeForDisplay(value, format, timeZone?)` gains an optional zone (default unchanged);
`formatDateTimeWithZone` appends the short label. `timezoneAbbreviation` maps IANA → `PT` / `MT` /
`CT` / `ET`.

Surfaces that now use the order zone and show the label:

- Admin order detail header (`SingleOrder`) and on-demand timeline (`SingleOnDemandOrder`).
- `OrderDetails` pickup / delivery times.
- Catering and on-demand list tables (date column).
- Client order-details page.
- Edit dialog preview and time input.

Stays Pacific (payload has no pickup address, or the value is not an order time):

- `UserOrdersTable`, client dashboard upcoming-orders card, `DashboardHome` created-at column.
- Driver surfaces, tracking, reports, emails, SMS: separate card once the pilot is in Austin.

## Migration and backfill

`prisma/migrations/20261015000000_address_timezone/migration.sql`:

```sql
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS timezone text;
UPDATE addresses SET timezone = ... WHERE timezone IS NULL AND zip ~ '^\d{5}' AND <prefix ranges>;
```

Idempotent (`IF NOT EXISTS`, `WHERE timezone IS NULL`), no index, no NOT NULL. The code reads the
column through Prisma, so the migration must be applied on rs-dev and prod before or together with
the deploy; it is not applied anywhere yet. Rollback: `ALTER TABLE addresses DROP COLUMN timezone`.
Zero existing orders touch Texas (prod read 2026-10-08), so no stored instant needs correcting.

## Decisions (approved 2026-11-03)

1. The pickup address zone applies to both pickup and arrival times. Kept as designed.
2. The create forms (catering, on-demand) show the resolved zone next to the pickup time picker
   before submit (`OrderTimezoneHint`: "Times in CT"). It updates when the pickup address changes
   and falls back to the default zone label (PT) when no pickup address is chosen yet. It resolves
   the zone with the same `resolveAddressTimezone` input that `orderTimesInPickupZone` uses on submit.
3. CaterValley and other partner APIs: out of scope, no change.
4. Driver app, notification emails and SMS: out of scope here; separate follow-up card.
