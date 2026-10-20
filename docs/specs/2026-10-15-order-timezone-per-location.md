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
  re-read in the pickup address zone (`reinterpretWallClock`). A CA admin typing 11:00 for an Austin
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

## Open questions for Emmanuel

1. Pickup zone for both times: confirm, or should arrival follow the delivery address?
2. Should the admin forms show the resolved zone next to the pickers before submit (small UX add)?
3. CaterValley sends `deliveryDate` + `deliveryTime` as Pacific wall-clock today. When Austin
   partners go live, does the contract add a zone field or do we derive it from the delivery ZIP?
4. Driver app and notification emails: same card now, or after the first Austin pilot?
