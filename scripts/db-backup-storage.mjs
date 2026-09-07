#!/usr/bin/env node
// Supabase Storage helper for the nightly database backup workflow.
// Zero dependencies (Node >= 20, global fetch).
//
//   node scripts/db-backup-storage.mjs verify <object-name> [...]
//       Fail unless every named object exists under BACKUP_PREFIX with size > 0.
//
//   node scripts/db-backup-storage.mjs rotate
//       Delete objects under BACKUP_PREFIX whose file-name date is older than
//       RETENTION_DAYS. Only names shaped `ready-set-<env>-YYYY-MM-DD[.suffix]`
//       are ever considered; anything else is left alone.
//
// Env:
//   BACKUP_SUPABASE_URL               https://<ref>.supabase.co of the project holding the dumps
//   BACKUP_SUPABASE_SERVICE_ROLE_KEY  service-role key of that project
//   BACKUP_BUCKET                     default: db-backups
//   BACKUP_PREFIX                     default: ready-set/production
//   RETENTION_DAYS                    default: 30
//
// Runbook: docs/deployment/BACKUPS.md

const baseUrl = (process.env.BACKUP_SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.env.BACKUP_SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.BACKUP_BUCKET || 'db-backups';
const prefix = (process.env.BACKUP_PREFIX || 'ready-set/production').replace(/^\/+|\/+$/g, '');
const retentionDays = Number.parseInt(process.env.RETENTION_DAYS || '30', 10);

if (!baseUrl || !key) {
  console.error('Missing BACKUP_SUPABASE_URL or BACKUP_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}
if (!Number.isInteger(retentionDays) || retentionDays < 1) {
  console.error(`RETENTION_DAYS must be a positive integer, got '${process.env.RETENTION_DAYS}'`);
  process.exit(2);
}

const headers = {
  Authorization: `Bearer ${key}`,
  apikey: key,
  'Content-Type': 'application/json',
};

const DATED_NAME = /^ready-set-[a-z]+-(\d{4})-(\d{2})-(\d{2})(?:\..+)?$/;

async function listObjects() {
  const res = await fetch(`${baseUrl}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prefix,
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    }),
  });
  if (!res.ok) {
    throw new Error(`List ${bucket}/${prefix} failed: ${res.status} ${await res.text()}`);
  }
  const entries = await res.json();
  if (!Array.isArray(entries)) {
    throw new Error(`List ${bucket}/${prefix} returned a non-array response`);
  }
  // Folders come back with id === null; only keep real objects.
  return entries.filter((e) => e && e.id);
}

function sizeOf(entry) {
  const raw = entry.metadata?.size ?? entry.metadata?.contentLength;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function verify(names) {
  if (names.length === 0) {
    console.error('verify: give at least one object name');
    process.exit(2);
  }
  const entries = await listObjects();
  const byName = new Map(entries.map((e) => [e.name, e]));
  let failed = false;
  for (const name of names) {
    const entry = byName.get(name);
    const size = entry ? sizeOf(entry) : null;
    if (!entry) {
      console.error(`MISSING  ${bucket}/${prefix}/${name}`);
      failed = true;
    } else if (size === null || size <= 0) {
      console.error(`EMPTY    ${bucket}/${prefix}/${name} (size=${size})`);
      failed = true;
    } else {
      console.log(`OK       ${bucket}/${prefix}/${name} (${size} bytes)`);
    }
  }
  if (failed) process.exit(1);
}

async function rotate() {
  const entries = await listObjects();
  const today = new Date();
  const cutoff = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) -
    retentionDays * 86_400_000;

  const dated = [];
  let skipped = 0;
  for (const entry of entries) {
    const m = DATED_NAME.exec(entry.name);
    if (!m) {
      skipped += 1;
      continue;
    }
    const stamp = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    dated.push({ name: entry.name, stamp });
  }

  const expired = dated.filter((d) => d.stamp < cutoff).map((d) => d.name);
  const kept = dated.length - expired.length;
  console.log(
    `${bucket}/${prefix}: ${dated.length} dated objects, keeping ${kept} (<= ${retentionDays} days), ` +
      `deleting ${expired.length}, ignoring ${skipped} undated.`
  );

  if (expired.length === 0) return;

  // Safety: never wipe the whole folder in one go.
  if (kept === 0) {
    console.error('Refusing to delete: rotation would leave zero dated backups. Check the clock or RETENTION_DAYS.');
    process.exit(1);
  }

  const res = await fetch(`${baseUrl}/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ prefixes: expired.map((n) => `${prefix}/${n}`) }),
  });
  if (!res.ok) {
    throw new Error(`Delete failed: ${res.status} ${await res.text()}`);
  }
  for (const name of expired) console.log(`deleted  ${name}`);
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'verify') await verify(args);
  else if (command === 'rotate') await rotate();
  else {
    console.error('Usage: db-backup-storage.mjs <verify <name...> | rotate>');
    process.exit(2);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
