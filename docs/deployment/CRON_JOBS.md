# Cron Jobs

Ready Set moved off Vercel onto the self-hosted Dokploy box on **2026-08-18**
(images built by `.github/workflows/build-and-push.yml`, pushed to GHCR,
auto-deployed by Dokploy). Until then the six scheduled jobs below were
triggered by Vercel Cron from the `crons[]` block of `vercel.json`.

**Nothing has triggered them since the cutover.** `vercel.json` is gone; the
schedules must be recreated on the VPS (system crontab or a Dokploy Schedule)
as plain HTTPS calls against the running app. The route handlers themselves
are unchanged.

All times are **UTC** — Vercel Cron always ran in UTC, so the schedules below
are the exact ones that used to run.

## Jobs

| Route | Method | Schedule (UTC) | Auth | Purpose |
| --- | --- | --- | --- | --- |
| `/api/admin/quarantine-cleanup` | `GET` (POST also accepted) | `0 2 * * *` — daily 02:00 | `Authorization: Bearer $CRON_SECRET`, or an admin session | Deletes quarantined uploads older than 30 days and purges expired upload rate-limit entries (`UploadSecurityManager`). |
| `/api/admin/mileage-recalculation` | `GET` (POST also accepted) | `0 */6 * * *` — every 6 h (00/06/12/18) | `Authorization: Bearer $CRON_SECRET`, or an admin session | Recalculates driver mileage for shifts touched in the last 24 h, 50 shifts per batch (`runDriverMileageRecalculation`). Returns 207 when some shifts errored. |
| `/api/admin/data-archiving` | `GET` (POST also accepted) | `0 3 * * *` — daily 03:00 | `Authorization: Bearer $CRON_SECRET`, or an admin / super_admin session | Moves driver locations older than 30 days and shifts older than 5 weeks to archive tables; soft-archives orders older than 30 days (REA-313). |
| `/api/admin/driver-summary-generation` | `GET` (POST also accepted) | `0 4 * * 0` — Sundays 04:00 | `Authorization: Bearer $CRON_SECRET`, or an admin / super_admin session | Pre-computes weekly per-driver aggregates: shifts, deliveries, GPS vs reported miles, location density (REA-313). |
| `/api/admin/sms-reminders/cron?type=next_day` | `GET` only | `0 0 * * *` — daily 00:00 | `Authorization: Bearer $CRON_SECRET`, or an SMS-admin session | Sends next-day delivery reminder SMS (tomorrow's deliveries) via `runSmsReminderBatch`. |
| `/api/admin/sms-reminders/cron?type=same_day` | `GET` only | `0 13 * * *` — daily 13:00 | `Authorization: Bearer $CRON_SECRET`, or an SMS-admin session | Sends same-day delivery reminder SMS (today's deliveries) via `runSmsReminderBatch`. |

Auth facts that matter for scheduling:

- **No route checks a Vercel-specific header** (`x-vercel-cron` or similar).
  A plain `Authorization: Bearer <CRON_SECRET>` header is the only thing a
  non-interactive caller needs.
- `CRON_SECRET` must be set in the app container's environment (Dokploy →
  application → Environment). If it is unset, the four `admin/*` maintenance
  routes fall through to the admin-session check and answer **401** to curl;
  the SMS route answers **500** in production.
- The SMS route derives "today"/"tomorrow" from the container's local clock
  (`new Date()`), and the Docker image does not set `TZ`, so it runs on UTC.
  `type=next_day` at 00:00 UTC therefore targets the next UTC calendar day —
  the same behaviour as on Vercel.

## How to recreate on the VPS

Use `CRON_TZ=UTC` so the box's local timezone cannot shift the schedules
(supported by cronie and current Debian/Ubuntu cron; if your cron ignores it,
convert the hours to the box's timezone — check with `timedatectl`).

Put the secret in the crontab environment (or `/etc/cron.d/ready-set`, root
owned, mode 600) and use the **same value** the app container has.

```cron
# /etc/cron.d/ready-set — ready-set scheduled jobs (formerly vercel.json crons)
CRON_TZ=UTC
SHELL=/bin/sh
CRON_SECRET=<same value as the app container's CRON_SECRET>
BASE=https://readysetllc.com
LOG=/var/log/ready-set-cron.log

# m  h  dom mon dow  user  command
0    2  *   *   *    root  curl -fsS -m 600 -X GET -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/admin/quarantine-cleanup" >> $LOG 2>&1
0    */6 *  *   *    root  curl -fsS -m 600 -X GET -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/admin/mileage-recalculation" >> $LOG 2>&1
0    3  *   *   *    root  curl -fsS -m 900 -X GET -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/admin/data-archiving" >> $LOG 2>&1
0    4  *   *   0    root  curl -fsS -m 900 -X GET -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/admin/driver-summary-generation" >> $LOG 2>&1
0    0  *   *   *    root  curl -fsS -m 600 -X GET -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/admin/sms-reminders/cron?type=next_day" >> $LOG 2>&1
0    13 *   *   *    root  curl -fsS -m 600 -X GET -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/admin/sms-reminders/cron?type=same_day" >> $LOG 2>&1
```

If you use a user crontab (`crontab -e`) instead of `/etc/cron.d`, drop the
`user` column.

Smoke-test one job by hand before trusting the schedule:

```bash
curl -fsS -X GET -H "Authorization: Bearer $CRON_SECRET" https://readysetllc.com/api/admin/quarantine-cleanup
# -> {"success":true,"filesCleanedCount":...,"rateLimitsCleanedCount":...}
```

A `401` means the header/secret does not match the container's `CRON_SECRET`;
a `500 {"error":"CRON_SECRET not configured"}` from the SMS route means the
container has no secret set.

### Development

The same block works for `development.readysetllc.com` — change `BASE` and
use the dev container's `CRON_SECRET`. The SMS jobs send real Twilio messages,
so only schedule those on dev if that is actually wanted.

### Alternative: Dokploy Schedules

Dokploy can run the same `curl` commands on the server on a cron expression
(application → Schedules). Either place is fine; do not configure both.

## Related

- `docs/sms-reminders.md` — SMS reminder pipeline and manual testing.
- `docs/deployment/VERCEL_CRON_DEPLOYMENT.md` — historical Vercel-era guide
  (superseded by this document).
- `.env.example` — `CRON_SECRET` generation.
