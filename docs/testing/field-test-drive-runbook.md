# Field test drive runbook

How to prepare, run, and close a driver field test when the tester and the
engineer are in different cities.

## Why this runbook exists

The 2026-08-06 walking run finished every functional step but could not close
its shift. Two seed orders from June, pinned to Mexico City, were sitting on
the shared test-driver account while the tester stood in León:

- The **arrival geofence** is 150 m. At 198 mi away, "I've arrived at vendor"
  stays disabled.
- There is **no dismiss or cancel action** on a driver's delivery card.
- The **end-shift guard** (`src/app/actions/tracking/driver-actions.ts`) counts
  those orders and disables End Shift. Its override only works for privileged
  callers, so a driver can never self-unblock.

Critically, the guard also blocks on `driverStatus = 'ASSIGNED'` when
`pickupDateTime` is already due. Those June orders had a July 23 pickup, so
they were blocking **before the tester touched anything**. Nothing the tester
could have done at run time would have avoided it.

The rule that follows: **the account must be verified clean before the shift
starts, and every stop must be generated at the tester's own coordinates.**

## Before the run — engineer

Point `.env.local` at `rs-dev`, then dry-run the reset. It reports and writes
nothing until you pass `--apply`.

```bash
pnpm test:drive:reset -- --driver <tester-email> --city leon
```

It prints the driver's current blocking state: non-terminal `deliveries` rows,
orders blocking end-shift, and any open shift. Review that list, then:

```bash
pnpm test:drive:reset -- --driver <tester-email> --city leon --apply
```

This cancels stale delivery rows, unassigns blocking orders (deleting the
dispatch, never the order), closes dangling shifts, and seeds one fresh order
whose pickup and dropoff are generated **relative to the tester's start point**.

Safety rails:

- Refuses to run if `DATABASE_URL` points at the production project.
- Refuses to clear anything whose order number isn't recognisably synthetic
  (`RSQA-`, `WALK-TEST-`, `DRIVE-TEST-`, `CC-SMOKE-`) unless you pass `--force`.
- Wraps every write in one transaction.

### Getting the tester's coordinates

`--city leon | cdmx | sf` covers the usual cases. For anywhere else, ask the
tester to drop a pin in Google Maps at their starting point, long-press, and
copy the numbers:

```bash
pnpm test:drive:reset -- --driver <email> --lat 21.1219 --lng -101.6833 --apply
```

The generated stops sit 250 m (vendor) and 750 m (client) from that point, both
outside the 150 m geofence — so the walk to each is a real leg that visibly
flips the advance button from disabled to enabled. Override with
`--pickup-distance` / `--dropoff-distance` if the tester needs a longer route.

The pickup is scheduled 30 minutes ahead of now, which keeps the guard's
overdue-assignment branch from firing on a freshly seeded order.

## During the run — tester

1. Start the shift **standing at the coordinates you sent**, not en route.
2. Confirm the Track screen shows **exactly one** active delivery. If it shows
   more, stop and tell the engineer — do not tap through them. Advancing an
   unrelated card makes it harder to clear, not easier.
3. Walk the legs. Note the order number from the card; if it's truncated, open
   the delivery detail view to get the full one.

## After the run — engineer

Verify against `rs-dev` before writing up results:

- The order reached `COMPLETED`.
- `driver_locations` has a GPS trail across the run window.
- Signature and POD artifacts are attached.
- The shift closed, and `delivery_count` matches.

Then run the reset again to leave the account clean for the next person.

## One account per tester

Give each tester their own driver login. The shared `driver.test@example.com`
account is how one person's abandoned run becomes another person's blocker, and
it makes "whose order is this?" unanswerable from the phone. The reset script
takes `--driver <email>`, so per-tester accounts cost nothing to support.

## Known gaps this runbook works around

These are workarounds, not fixes. Both deserve tickets:

1. **No driver-side escape hatch.** A stale in-progress delivery permanently
   blocks a driver's shift with no self-service recovery. Options: let a driver
   abandon a delivery with a reason, or auto-expire in-progress deliveries whose
   pickup is more than N hours past.
2. **No cleanup of orphaned seed data.** Nothing reaps test orders left in a
   movement state. Until something does, this script is the reaper.
