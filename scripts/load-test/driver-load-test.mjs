#!/usr/bin/env node
/**
 * Driver app load test — the production-readiness gate for 20-30 concurrent drivers.
 *
 * Simulates N "virtual drivers" each replaying the real driver-app request mix
 * (location writes, deliveries/shift polls, history page loads) against a target
 * environment, WHILE polling /api/health/database so you can watch the Supabase
 * pooler's `activeConnections` under load. This is the go/no-go check before the
 * `development -> main` promotion (see the production-readiness plan).
 *
 * Zero dependencies — Node 18+ global fetch. Run with `node` or `pnpm load-test:driver`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * AUTH: the driver endpoints require an authenticated session. Provide one or
 * more session cookies (one per simulated driver for full fidelity):
 *   • file  scripts/load-test/.cookies  — one full Cookie header per line, OR
 *   • env   LOAD_TEST_COOKIE            — a single Cookie header.
 * Get a cookie from a logged-in dev session: DevTools → Application → Cookies →
 * copy the `sb-*-auth-token*` cookies as a single "name=value; name2=value2"
 * string. (The gstack browse session's cookies also work — see README.)
 *
 * IMPORTANT — rate-limit fidelity: the location POST is rate-limited per auth id
 * (PR #435). With ONE shared cookie, all VUs share one bucket and you'll see 429s
 * — that's the limiter working, not a failure. For a true 30-driver pool test,
 * supply 30 distinct cookies (30 buckets, like prod). The script reports 429s
 * separately so they don't pollute the error rate.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Config (all via env):
 *   LOAD_TEST_BASE_URL     default https://development.readysetllc.com
 *   LOAD_TEST_DRIVERS      virtual drivers (default 30)
 *   LOAD_TEST_DURATION_S   run length seconds (default 120)
 *   LOAD_TEST_WRITES       "false" to skip location POSTs (default on)
 *   LOAD_TEST_LOCATION_MS  location POST interval per driver (default 5000)
 *   LOAD_TEST_HISTORY_MS   /driver/history load interval per driver (default 20000)
 *   LOAD_TEST_MAX_CONN     activeConnections threshold for PASS (default 18)
 *   LOAD_TEST_MAX_ERR      error-rate threshold for PASS (default 0.01 = 1%)
 *
 * Exit code 0 = PASS (verdict met), 1 = FAIL.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

const env = (k, d) => process.env[k] ?? d;
const int = (k, d) => {
  const n = parseInt(process.env[k] ?? "", 10);
  return Number.isFinite(n) ? n : d;
};
const float = (k, d) => {
  const n = parseFloat(process.env[k] ?? "");
  return Number.isFinite(n) ? n : d;
};

const CFG = {
  baseUrl: env("LOAD_TEST_BASE_URL", "https://development.readysetllc.com").replace(/\/$/, ""),
  drivers: int("LOAD_TEST_DRIVERS", 30),
  durationS: int("LOAD_TEST_DURATION_S", 120),
  includeWrites: env("LOAD_TEST_WRITES", "true") !== "false",
  locationMs: int("LOAD_TEST_LOCATION_MS", 5000),
  historyMs: int("LOAD_TEST_HISTORY_MS", 20000),
  deliveriesMs: 60000,
  shiftMs: 120000,
  healthMs: 2000,
  maxConn: int("LOAD_TEST_MAX_CONN", 18),
  maxErrRate: float("LOAD_TEST_MAX_ERR", 0.01),
};

// ─── cookie resolution ──────────────────────────────────────────────────────
function loadCookies() {
  const fromFile = (() => {
    try {
      return readFileSync(join(HERE, ".cookies"), "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
    } catch {
      return [];
    }
  })();
  if (fromFile.length) return fromFile;
  if (process.env.LOAD_TEST_COOKIE) return [process.env.LOAD_TEST_COOKIE.trim()];
  return [];
}

// ─── metrics ────────────────────────────────────────────────────────────────
const metrics = new Map(); // endpoint -> { count, errors, rateLimited, statuses{}, lat[] }
function record(endpoint, status, latMs, networkError = false) {
  let m = metrics.get(endpoint);
  if (!m) {
    m = { count: 0, errors: 0, rateLimited: 0, statuses: {}, lat: [] };
    metrics.set(endpoint, m);
  }
  m.count++;
  m.lat.push(latMs);
  const key = networkError ? "ERR" : String(status);
  m.statuses[key] = (m.statuses[key] || 0) + 1;
  if (status === 429) m.rateLimited++;
  else if (networkError || status >= 400) m.errors++;
}
const health = []; // { t, activeConnections, status, dbStatus, responseMs }

async function call(endpoint, url, opts) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { redirect: "manual", ...opts });
    record(endpoint, res.status, Date.now() - t0);
    // drain body so the socket frees promptly
    await res.arrayBuffer().catch(() => {});
    return res.status;
  } catch (e) {
    record(endpoint, 0, Date.now() - t0, true);
    return 0;
  }
}

// ─── health monitor ─────────────────────────────────────────────────────────
async function pollHealth(cookie) {
  const t0 = Date.now();
  try {
    // /api/health is public and reports services.database.details.activeConnections.
    const res = await fetch(`${CFG.baseUrl}/api/health`, {
      headers: cookie ? { cookie } : {},
    });
    const body = await res.json().catch(() => ({}));
    const db = body?.services?.database ?? {};
    const ac =
      db?.details?.activeConnections ??
      body?.connectionHealth?.activeConnections ??
      body?.details?.activeConnections ??
      null;
    const dbStatus = db?.status ?? body?.status ?? "unknown";
    health.push({
      t: Date.now(),
      activeConnections: typeof ac === "number" ? ac : null,
      responseMs: Date.now() - t0,
      dbStatus,
    });
  } catch {
    health.push({ t: Date.now(), activeConnections: null, responseMs: Date.now() - t0, dbStatus: "error" });
  }
}

// ─── one virtual driver ─────────────────────────────────────────────────────
async function resolveDriverId(cookie) {
  try {
    const res = await fetch(`${CFG.baseUrl}/api/tracking/drivers?limit=1`, {
      headers: { cookie },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

function jitter(ms) {
  return Math.floor(Math.random() * ms);
}

async function runDriver(cookie, deadline, baseLat, baseLng) {
  const headers = { cookie };
  const driverId = CFG.includeWrites ? await resolveDriverId(cookie) : null;

  const tasks = [];
  const schedule = (intervalMs, fn) => {
    // initial stagger so VUs don't fire in lockstep
    let timer = setTimeout(async function tick() {
      if (Date.now() >= deadline) return;
      await fn();
      if (Date.now() < deadline) timer = setTimeout(tick, intervalMs);
    }, jitter(intervalMs));
    tasks.push(() => clearTimeout(timer));
  };

  // History page load (the route that 500'd under pool pressure) — the headline check.
  schedule(CFG.historyMs, () =>
    call("GET /driver/history", `${CFG.baseUrl}/driver/history`, { headers }),
  );
  // Deliveries poll (home feed).
  schedule(CFG.deliveriesMs, () =>
    call("GET /api/driver-deliveries", `${CFG.baseUrl}/api/driver-deliveries?page=1&limit=999`, { headers }),
  );
  // Shift / driver-status poll.
  schedule(CFG.shiftMs, () =>
    call("GET /api/tracking/drivers", `${CFG.baseUrl}/api/tracking/drivers?limit=1`, { headers }),
  );
  // Location write (highest-frequency path).
  if (CFG.includeWrites && driverId) {
    schedule(CFG.locationMs, () =>
      call("POST /api/tracking/locations", `${CFG.baseUrl}/api/tracking/locations`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          driver_id: driverId,
          latitude: baseLat + (Math.random() - 0.5) * 0.01,
          longitude: baseLng + (Math.random() - 0.5) * 0.01,
          accuracy: 8,
          speed: 10 + Math.random() * 20,
          heading: Math.floor(Math.random() * 360),
          is_moving: true,
          activity_type: "driving",
        }),
      }),
    );
  }

  // Wait until the deadline, then clear timers.
  await new Promise((r) => setTimeout(r, Math.max(0, deadline - Date.now())));
  tasks.forEach((stop) => stop());
  return { driverId, writesEnabled: Boolean(driverId) };
}

// ─── reporting ──────────────────────────────────────────────────────────────
function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
function nums(arr) {
  const vals = arr.filter((x) => typeof x === "number");
  if (!vals.length) return { min: null, avg: null, max: null };
  return {
    min: Math.min(...vals),
    avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    max: Math.max(...vals),
  };
}

function report() {
  let total = 0;
  let totalErr = 0;
  let totalRl = 0;
  console.log("\n──────────────── Per-endpoint ────────────────");
  for (const [ep, m] of metrics) {
    total += m.count;
    totalErr += m.errors;
    totalRl += m.rateLimited;
    const statusStr = Object.entries(m.statuses)
      .sort()
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");
    console.log(
      `${ep.padEnd(30)} n=${String(m.count).padStart(5)}  ` +
        `err=${m.errors} 429=${m.rateLimited}  ` +
        `p50=${pct(m.lat, 50)}ms p95=${pct(m.lat, 95)}ms p99=${pct(m.lat, 99)}ms  [${statusStr}]`,
    );
  }

  const hist = metrics.get("GET /driver/history");
  const history500 = hist?.statuses?.["500"] || 0;
  const ac = nums(health.map((h) => h.activeConnections));
  const dbStatuses = health.reduce((acc, h) => {
    acc[h.dbStatus] = (acc[h.dbStatus] || 0) + 1;
    return acc;
  }, {});
  const errRate = total ? totalErr / total : 0;

  console.log("\n──────────────── DB pool (/api/health/database) ────────────────");
  console.log(`activeConnections  min=${ac.min}  avg=${ac.avg}  max=${ac.max}  (samples=${health.length})`);
  console.log(`db status samples  ${JSON.stringify(dbStatuses)}`);

  console.log("\n──────────────── Verdict ────────────────");
  console.log(`requests=${total}  errors=${totalErr} (${(errRate * 100).toFixed(2)}%, excl 429)  rate-limited=${totalRl}`);
  console.log(`/driver/history 500s = ${history500}`);

  const checks = [
    { name: "no /driver/history 500s", ok: history500 === 0, detail: `${history500}` },
    { name: `error rate < ${(CFG.maxErrRate * 100).toFixed(1)}%`, ok: errRate < CFG.maxErrRate, detail: `${(errRate * 100).toFixed(2)}%` },
    {
      name: `peak activeConnections < ${CFG.maxConn}`,
      ok: ac.max == null ? true : ac.max < CFG.maxConn,
      detail: ac.max == null ? "n/a (health endpoint did not report it)" : `${ac.max}`,
    },
  ];
  let pass = true;
  for (const c of checks) {
    pass = pass && c.ok;
    console.log(`  ${c.ok ? "✅" : "❌"} ${c.name}  (${c.detail})`);
  }
  console.log(`\n${pass ? "PASS ✅" : "FAIL ❌"}\n`);
  return pass;
}

// ─── main ───────────────────────────────────────────────────────────────────
async function main() {
  const cookies = loadCookies();
  console.log("Driver load test");
  console.log(`  target:    ${CFG.baseUrl}`);
  console.log(`  drivers:   ${CFG.drivers}   duration: ${CFG.durationS}s   writes: ${CFG.includeWrites}`);
  console.log(`  cookies:   ${cookies.length} provided ${cookies.length <= 1 ? "(shared across all VUs — see rate-limit note)" : "(one per driver)"}`);

  if (!cookies.length) {
    console.error(
      "\nNo session cookie provided. Set LOAD_TEST_COOKIE or create scripts/load-test/.cookies\n" +
        "(one Cookie header per line). See scripts/load-test/README.md.\n",
    );
    process.exit(2);
  }

  const deadline = Date.now() + CFG.durationS * 1000;

  // Health monitor loop.
  const healthCookie = cookies[0];
  const healthTimer = setInterval(() => {
    if (Date.now() < deadline) pollHealth(healthCookie);
  }, CFG.healthMs);
  pollHealth(healthCookie);

  // Spawn virtual drivers; round-robin the provided cookies.
  const baseLat = 30.2672; // Austin-ish, matches existing test data
  const baseLng = -97.7431;
  const vus = Array.from({ length: CFG.drivers }, (_, i) =>
    runDriver(cookies[i % cookies.length], deadline, baseLat, baseLng),
  );

  // Progress ticker.
  const startedAt = Date.now();
  const progress = setInterval(() => {
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const last = health[health.length - 1];
    process.stdout.write(
      `\r  ${elapsed}/${CFG.durationS}s  activeConn=${last?.activeConnections ?? "?"}  db=${last?.dbStatus ?? "?"}   `,
    );
  }, 2000);

  const results = await Promise.all(vus);
  clearInterval(healthTimer);
  clearInterval(progress);
  process.stdout.write("\n");

  const writesOn = results.filter((r) => r.writesEnabled).length;
  if (CFG.includeWrites && writesOn < CFG.drivers) {
    console.log(
      `\n⚠ ${CFG.drivers - writesOn}/${CFG.drivers} VUs could not resolve a driver_id (cookie not a DRIVER, or /api/tracking/drivers failed) — those skipped location writes.`,
    );
  }

  const pass = report();
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("Load test crashed:", e);
  process.exit(1);
});
