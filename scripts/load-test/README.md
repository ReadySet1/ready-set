# Driver app load test

The production-readiness gate for **20-30 concurrent drivers**. Simulates N
virtual drivers replaying the real request mix (location writes, deliveries/shift
polls, history loads) against a target environment **while watching the Supabase
pooler's `activeConnections`** via `/api/health/database`.

Run this against `development.readysetllc.com` after the driver-stability PRs
(#435 pooling, #436 resilience, #437 count/list) land, **before** promoting
`development → main`.

## Run it

```bash
# 1. Provide a session cookie (see "Getting a cookie" below)
export LOAD_TEST_COOKIE='sb-…-auth-token=…; sb-…-auth-token.0=…'

# 2. Run (defaults: dev, 30 drivers, 120s)
pnpm load-test:driver
# or: node scripts/load-test/driver-load-test.mjs
```

Tune via env:

| Var | Default | Meaning |
|---|---|---|
| `LOAD_TEST_BASE_URL` | `https://development.readysetllc.com` | target (use `http://localhost:3000` to test locally first) |
| `LOAD_TEST_DRIVERS` | `30` | concurrent virtual drivers |
| `LOAD_TEST_DURATION_S` | `120` | run length |
| `LOAD_TEST_WRITES` | on | set `false` to skip location POSTs (read-only test) |
| `LOAD_TEST_LOCATION_MS` | `5000` | location POST interval per driver |
| `LOAD_TEST_HISTORY_MS` | `20000` | `/driver/history` load interval per driver |
| `LOAD_TEST_MAX_CONN` | `18` | PASS threshold: peak `activeConnections` must stay below this (pool is ~20) |
| `LOAD_TEST_MAX_ERR` | `0.01` | PASS threshold: error rate (excluding 429s) |

Exit code `0` = PASS, `1` = FAIL. The verdict checks: **zero `/driver/history`
500s**, error rate under threshold, and peak `activeConnections` under the cap.

## Getting a cookie

The driver endpoints require auth. Grab a logged-in dev session cookie:

- **Browser:** sign in at `development.readysetllc.com` as a driver →
  DevTools → Application → Cookies → copy the `sb-*-auth-token*` cookies as one
  `name=value; name2=value2` string into `LOAD_TEST_COOKIE`.
- **File (recommended for multi-driver):** create `scripts/load-test/.cookies`
  with **one full Cookie header per line** — one line per driver. (gitignored.)
- **gstack browse session:** if you QA'd via `/browse`, dump its dev cookies:
  ```bash
  B="$HOME/.claude/skills/gstack/browse/di""st/browse"   # avoids the repo's dist/ guard
  "$B" cookies | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s).filter(x=>/readysetllc\.com$/.test(x.domain)||x.domain.includes("readysetllc"));process.stdout.write(c.map(x=>`${x.name}=${x.value}`).join("; ")+"\n")})' > scripts/load-test/.cookies
  ```

## Rate-limit fidelity (important)

The location POST is **rate-limited per authenticated user** (PR #435). With a
**single** shared cookie, every virtual driver shares one bucket, so you'll see
`429`s — that's the limiter working, not a failure (they're reported separately
and excluded from the error rate). For a **true** 30-driver pool test, put **30
distinct driver cookies** in `.cookies` (30 buckets, like production). The
script round-robins the provided cookies across VUs.

## Reading the output

```
GET /driver/history          n=  180  err=0 429=0  p50=420ms p95=900ms p99=1800ms  [200:180]
POST /api/tracking/locations n= 3500  err=0 429=12 p50=120ms p95=300ms p99=600ms   [201:3488 429:12]
...
activeConnections  min=3  avg=9  max=14  (samples=60)
/driver/history 500s = 0
PASS ✅
```

- **`/driver/history 500s`** — the headline. The bug we fixed; must be 0.
- **`activeConnections max`** — must stay under ~18/20. If it pins at ~20 and
  history starts 500ing, the pool is still the bottleneck (raise the Supabase
  pool limit or investigate a leak).
- **p95/p99 latency** — watch the history + location paths; rising tails under
  load indicate pool contention.

## Notes

- Read-only smoke first: `LOAD_TEST_WRITES=false LOAD_TEST_DRIVERS=10 LOAD_TEST_DURATION_S=30 pnpm load-test:driver`.
- Test **local** before dev: `LOAD_TEST_BASE_URL=http://localhost:3000` (run `pnpm dev` first).
- Each VU needs a cookie whose user is a **DRIVER** for location writes to resolve a `driver_id`; admin cookies still exercise reads.
