# Database Backups

**Scope:** the production Postgres (`ready-set-web`, Supabase, free plan → no platform backups) and, on demand, the dev one (`rs-dev`).
**Owner:** whoever reads ops mail — see [Alerting](#alerting).
**Last reviewed:** 2026-09-06 (pilot fix O1, board card `pilot-db-backup-workflow`).

If you are here because production is broken, jump to [Restore procedure](#restore-procedure).

---

## What runs

| | |
|---|---|
| Workflow | [`.github/workflows/db-backup.yml`](../../.github/workflows/db-backup.yml) |
| Schedule | daily `0 9 * * *` UTC = 02:00 PT (before business hours) |
| Manual | Actions → **Database Backup** → *Run workflow* → pick `production` or `development` |
| Tool | `pg_dump` 17 (custom format, gzip level 6, `--no-owner --no-privileges`) |
| Runtime | GitHub-hosted `ubuntu-latest`; ~2–5 min |

Each run produces three objects, named by the UTC date of the run:

| Object | Contents |
|---|---|
| `ready-set-<env>-YYYY-MM-DD.dump` | `public` schema — every table Prisma manages (profiles, orders, dispatches, drivers, shifts, GPS points, settings…) |
| `ready-set-<env>-YYYY-MM-DD.auth.dump` | `auth.users`, `auth.identities`, `auth.mfa_factors` — needed because `profiles.id == auth.users.id`; transient auth tables (sessions, refresh tokens, audit log) are deliberately excluded |
| `ready-set-<env>-YYYY-MM-DD.sha256` | checksums of the two dumps |

Not covered: Supabase Storage objects (uploaded images/files), edge functions, project settings, Postgres roles. None of these are mutated by the app in ways a nightly dump would protect.

The workflow verifies each dump offline with `pg_restore --list` (checks `public.profiles`, `public.catering_requests`, `public.driver_shifts` and `auth.users` are present), uploads, re-lists the bucket to confirm the objects exist with non-zero size, then rotates.

## Where dumps live

**Destination: a private Supabase Storage bucket in a *different* Supabase project than the one being dumped.**

```
<backup project>/storage/db-backups/ready-set/production/ready-set-production-2026-09-06.dump
<backup project>/storage/db-backups/ready-set/production/ready-set-production-2026-09-06.auth.dump
<backup project>/storage/db-backups/ready-set/production/ready-set-production-2026-09-06.sha256
<backup project>/storage/db-backups/ready-set/development/...         (manual dev runs only)
```

Why this destination:

- `destino-sf` already backs up to a Supabase Storage bucket named `db-backups` with the same `curl` + service-role pattern, so ops has one mechanism to learn.
- No new vendor, no IAM, free.
- Putting it in a *different* project (recommended: **rs-dev**, `khvteminrbghoeuqajzm`, us-west-1 — a different region from prod's us-east-1) means the copy survives the prod project being paused, deleted or corrupted. If you would rather not mix dev and backups, create a dedicated free project (e.g. `ready-set-backups`) and point the two `BACKUP_SUPABASE_*` secrets at it — nothing else changes.
- Rejected: `actions/upload-artifact` (repo is public — artifacts are downloadable by anyone with read access), AWS S3 (nothing in the repo or VPS uses AWS; the older `scripts/backup-production.sh` assumed a bucket that was never created), `scp` to the VPS (the VPS is the app host and itself has no off-host backup yet — see `infra/MAINTENANCE.md`).

The bucket is **private** (no public access). Only the service-role key can read or write it.

## Required secrets

Repository secrets (Settings → Secrets and variables → Actions). Names only — never commit values.

| Secret | Value | Where to get it |
|---|---|---|
| `PROD_BACKUP_DATABASE_URL` | session-mode pooler URL of **ready-set-web** | Supabase dashboard → project → *Connect* → **Session pooler** (port **5432**) |
| `DEV_BACKUP_DATABASE_URL` | same shape for **rs-dev** | same, in the rs-dev project (only used for manual `development` runs; may be left unset until needed) |
| `BACKUP_SUPABASE_URL` | `https://<ref>.supabase.co` of the project that *holds* the dumps | Supabase dashboard → backup project → Settings → API → Project URL |
| `BACKUP_SUPABASE_SERVICE_ROLE_KEY` | service-role key of that same project | Settings → API → `service_role` (secret) |

### Exact connection-string shape

```
postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

- prod: `<project-ref>` = `jiasmmmmhtreoacdpiby`, `<region>` = `us-east-1`
- dev:  `<project-ref>` = `khvteminrbghoeuqajzm`, `<region>` = `us-west-1`

Rules the workflow enforces (it fails before dumping if violated):

- **Port 5432 (session mode), never 6543.** `pg_dump` needs a real server session; the transaction-mode pooler on 6543 breaks it (prepared statements, `SET`, large objects).
- **No `?pgbouncer=true` and no `&connection_limit=1`.** Those are Prisma-only flags; `libpq` rejects unknown URI parameters. This is different from the app's `DATABASE_URL`, which *must* carry them — do not reuse that value.
- The direct host `db.<ref>.supabase.co` is **IPv6-only** on the free plan and GitHub runners are IPv4-only, so `DIRECT_URL` will not work from Actions (the workflow warns). The session pooler is IPv4 and behaves like a direct connection for `pg_dump`.
- URL-encode special characters in the password (`@` → `%40`, `#` → `%23`, …).

### One-time setup checklist (human)

1. In the **backup** project (rs-dev): Storage → *New bucket* → name `db-backups`, **Public bucket: OFF**, no file-size override (the free-plan cap is 50 MB per object — see [Retention & cost](#retention--cost)).
2. Add the four secrets above.
3. Actions → Database Backup → *Run workflow* → `production`. Confirm the run is green and the three objects appear under `db-backups/ready-set/production/`.
4. Do the [restore rehearsal](#30-minute-restore-rehearsal) once, then put it on the calendar quarterly.
5. Make sure the person who last edited the `cron:` line in the workflow file is someone who reads GitHub failure mail (see [Alerting](#alerting)).

## Running it manually

- **From GitHub:** Actions → **Database Backup** → *Run workflow* → environment → *Run*. The step summary shows file sizes and checksums.
- **Locally (ad hoc, e.g. before a risky migration):**

  ```bash
  # needs pg_dump >= 15 for prod (>= 17 for dev): brew install libpq && brew link --force libpq
  export PGURL='postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
  pg_dump "$PGURL" -Fc -Z 6 --no-owner --no-privileges -n public -f ready-set-production-$(date -u +%F).dump
  pg_dump "$PGURL" -Fc -Z 6 --no-owner --no-privileges -t auth.users -t auth.identities -t auth.mfa_factors \
    -f ready-set-production-$(date -u +%F).auth.dump
  ```

  Park local copies under the workspace's `infra/backups/ready-set-prod/` (git-ignored, same naming convention as `infra/backups/destino-prod/`). Never put a dump in this repository, in `~/Downloads`, or on a shared drive.

## Downloading a dump

From the Supabase dashboard of the backup project: Storage → `db-backups` → `ready-set/production/` → file → *Download*. Or with `curl`:

```bash
export BACKUP_SUPABASE_URL='https://<backup-ref>.supabase.co'
export BACKUP_SUPABASE_SERVICE_ROLE_KEY='...'
F=ready-set-production-2026-09-06
for ext in dump auth.dump sha256; do
  curl --fail -sS -o "$F.$ext" \
    -H "Authorization: Bearer $BACKUP_SUPABASE_SERVICE_ROLE_KEY" \
    "$BACKUP_SUPABASE_URL/storage/v1/object/authenticated/db-backups/ready-set/production/$F.$ext"
done
sha256sum -c "$F.sha256"
```

## Restore procedure

**Always restore into rs-dev first.** Only after the verification queries pass there do you point the same commands at production. Restoring into prod is destructive (`--clean` drops and recreates every `public` table); it is the last step of an incident, not the first.

Prereqs: `pg_restore` 17, the three files for the date you want, and the session-pooler URL of the **target** (same shape as above, port 5432).

```bash
export TARGET_URL='postgresql://postgres.<target-ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
F=ready-set-production-2026-09-06

# 0. Sanity: checksums + what is inside
sha256sum -c "$F.sha256"
pg_restore --list "$F.dump" | grep -c 'TABLE DATA'        # expect ~40+ tables

# 1. Take a safety dump of the TARGET before touching it (yes, even rs-dev)
pg_dump "$TARGET_URL" -Fc -n public -f "pre-restore-$(date -u +%FT%H%M%SZ).dump"

# 2. Stop writers: pause the Dokploy app for that environment (or accept a few lost writes on dev)

# 3. Restore application data (public schema)
pg_restore --clean --if-exists --no-owner --no-privileges \
  --schema=public --jobs=4 \
  -d "$TARGET_URL" "$F.dump"
```

Notes on step 3:

- `--clean --if-exists` drops each object before recreating it, so the target ends up *exactly* as the dump — extra rows/tables in the target are gone.
- Expect a handful of `ERROR: must be owner of extension` / `role "..." does not exist` lines for Supabase-managed objects; `pg_restore` continues and exits non-zero. Read the errors; if every one is about extensions, roles, RLS policies referencing `auth.uid()` you already have, or `ALTER ... OWNER`, the restore is fine. Errors on `COPY` or `CREATE TABLE` are not fine — stop and investigate.
- If the target is a **fresh** project with no schema, run `pnpm prisma migrate deploy` against it first so extensions and Supabase roles exist, then restore with `--data-only --disable-triggers` instead of `--clean`.

```bash
# 4. Restore auth identities (only when the target's auth.users is missing rows — e.g. a fresh
#    project, or prod after a user-table wipe). Skip this on rs-dev unless you are rehearsing it.
pg_restore --data-only --no-owner --no-privileges --disable-triggers \
  -d "$TARGET_URL" "$F.auth.dump"
#    Conflicts on existing users show as duplicate-key errors on auth.users — that is expected
#    when the target already has those users; nothing else is touched.
```

```bash
# 5. Prisma bookkeeping: the dump includes public._prisma_migrations, so the schema and the
#    migration ledger stay consistent. Confirm nothing is pending:
pnpm dotenv -e .env.local -- prisma migrate status
```

```bash
# 6. Bring the app back (Dokploy → application → Start / Redeploy) and run the verification queries.
```

### Verification queries

Run against the target (`psql "$TARGET_URL"` or the Supabase SQL editor) and compare with the same queries against the source, or with the counts from the day before the incident:

```sql
select 'profiles'          as t, count(*) from public.profiles          where "deletedAt" is null
union all
select 'catering_requests', count(*) from public.catering_requests where "deletedAt" is null
union all
select 'on_demand_requests', count(*) from public.on_demand_requests where "deletedAt" is null
union all
select 'dispatches',        count(*) from public.dispatches
union all
select 'driver_shifts',     count(*) from public.driver_shifts
union all
select 'driver_locations',  count(*) from public.driver_locations
union all
select 'auth.users',        count(*) from auth.users;

-- Newest rows should be from just before the dump time (09:00 UTC on the file's date):
select max("createdAt") from public.catering_requests;
select max("startTime")  from public.driver_shifts;

-- Every profile still has its auth user (0 rows expected):
select p.id from public.profiles p left join auth.users u on u.id = p.id where u.id is null limit 20;
```

Then log in to the restored environment as an admin, open `/admin/tracking` and one order detail page.

### 30-minute restore rehearsal

Do this once after setup, then quarterly (add it to `infra/MAINTENANCE.md`'s quarterly list). Target is **rs-dev**; note the elapsed time for each box.

- [ ] (2 min) Download the newest three objects from `db-backups/ready-set/production/`; `sha256sum -c` passes.
- [ ] (1 min) `pg_restore --list` shows `TABLE DATA public profiles`, `catering_requests`, `driver_shifts`.
- [ ] (3 min) Safety dump of rs-dev taken (step 1).
- [ ] (1 min) Dev app paused in Dokploy.
- [ ] (5–10 min) Step 3 restore completes; error lines reviewed and only benign categories present.
- [ ] (2 min) `prisma migrate status` reports no pending migrations.
- [ ] (3 min) Verification counts match the source (or the workflow's step summary from that morning).
- [ ] (2 min) Orphan-profile query returns 0 rows (auth step run if not).
- [ ] (3 min) Dev app started; admin login works; `/admin/tracking` and an order page render.
- [ ] (2 min) Write date, elapsed time and any surprises in `docs/JOURNAL.md` under `[ready-set]`. Fix this runbook if a step was wrong.
- [ ] Optional: re-seed rs-dev test data (`pnpm driver:account` for the field-tester logins) if the restore replaced it.

If the rehearsal exceeds 30 minutes, that is the real RTO — write it down and decide whether it is acceptable for the pilot.

## Retention & cost

- **30 days**, enforced by `scripts/db-backup-storage.mjs rotate` at the end of every successful run. It only deletes objects named `ready-set-<env>-YYYY-MM-DD…` whose date is older than `RETENTION_DAYS`, and refuses to run if that would leave zero dated backups. Change `RETENTION_DAYS` in the workflow `env:` block to adjust.
- **Cost:** Supabase free plan includes 1 GB of Storage per project and caps each uploaded object at **50 MB**. The workflow warns when the application dump passes 45 MB. When that happens, pick one: shorten retention, move the bucket to a Pro project (100 GB, 5 GB per object, ~$25/mo), or exclude `public.driver_locations` history from the nightly dump (`--exclude-table-data=public.driver_locations`) and dump it weekly instead. Compressed custom-format dumps of this database are expected to be in the single-digit MB range at pilot scale.
- Free-plan projects that receive no API traffic for 7 days are paused. A nightly upload to rs-dev's Storage counts as traffic, so using rs-dev as the backup target also keeps it awake.

## Alerting

There is no Slack, Discord or Resend action anywhere in this repository's workflows, so a failed run relies on **GitHub's workflow-failure email**:

- GitHub emails the person who triggered the run. For **scheduled** runs, that is the user who last modified the `cron:` line in `db-backup.yml` — keep it Emmanuel (or whoever is on ops), and do not let an unrelated PR touch that line.
- Everyone on ops should have GitHub → Settings → Notifications → *Actions* → "Send notifications for failed workflows only" enabled.
- A failed run also leaves a red badge on the Actions tab and a *Failure summary* in the run's step summary.

Follow-up if this proves too quiet: have the failure step open/comment a GitHub issue via `gh` (needs `issues: write`), or route to Dokploy's notification channel once one is configured.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Secret PROD_BACKUP_DATABASE_URL is not set` | secret missing | add it (see table above) |
| `points at the transaction pooler (port 6543)` | wrong pooler | use *Session pooler* (5432) |
| `libpq rejects unknown URI parameters` | copied the app's `DATABASE_URL` | strip `?pgbouncer=true&connection_limit=1` |
| `could not translate host name` / `Network is unreachable` | direct host (IPv6-only) | use the session pooler host |
| `pg_dump: error: server version: 17.x; pg_dump version: 16.x` | client older than server | `PG_CLIENT_MAJOR` must be ≥ server major (dev is 17) |
| `permission denied for table users` on the auth dump | `postgres` role lost its grants on `auth` | run in the SQL editor: `grant select on all tables in schema auth to postgres;` |
| `413 Payload too large` on upload | dump > 50 MB free-plan cap | see [Retention & cost](#retention--cost) |
| `Bucket not found` | bucket missing in the backup project | create private bucket `db-backups` |
| `new row violates row-level security policy` | anon key used instead of service-role | use `service_role` for `BACKUP_SUPABASE_SERVICE_ROLE_KEY` |
| `Refusing to delete: rotation would leave zero dated backups` | clock/retention misconfig or wrong prefix | check `RETENTION_DAYS`, `BACKUP_PREFIX`, and that uploads landed |

## Related scripts (kept, not used by the workflow)

- `scripts/backup-db.ts` (`pnpm backup`) — local, plain-SQL (`-Fp`) dump of `public` to `./backups/` with a 5-file rotation and a table-count sanity check. Still handy for a quick pre-migration snapshot on a laptop; it is not wired to any storage. The workflow supersedes it for scheduled backups (custom format, off-platform copy, auth tables, checksums).
- `scripts/backup-production.sh`, `scripts/restore-backup.sh`, `scripts/deployment/backup-production-db.sh` — Vercel-era scripts that assume an AWS S3 bucket (`ready-set-backups`) and an encryption key file that were never provisioned. Do not run them as-is; use this runbook.
- `scripts/db-backup-storage.mjs` — the verify/rotate helper the workflow calls; safe to run locally with the four env vars set (read-only `verify`; `rotate` deletes).
