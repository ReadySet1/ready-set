#!/usr/bin/env node
// Commit-trailer changelog extractor.
//
// Collects user-facing changelog entries from commit messages and writes them
// into the current version's entry in src/data/changelog.json.
//
// Convention (commit footer):
//   Changelog: Live driver tracking now updates the map in real time.
//   Changelog-type: new        # optional: new | improved | fixed
//
// - `Changelog:` present  -> contributes a change item.
// - `Changelog:` absent   -> commit is ignored.
// - `Changelog-type:` absent -> inferred from the conventional-commit prefix
//   (feat->new, fix->fixed, perf/refactor->improved; default->improved).
//
// Idempotent: re-running replaces the current version's `changes` array; it
// never duplicates entries.
//
// Usage: node scripts/build-changelog.mjs

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const pkgPath = join(repoRoot, "package.json");
const dataPath = join(repoRoot, "src", "data", "changelog.json");

const VALID_TYPES = new Set(["new", "improved", "fixed"]);

// git byte placeholders used to delimit log output safely.
const FIELD = "\x1f"; // unit separator between subject and body
const RECORD = "\x1e"; // record separator between commits

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/** Most recent tag reachable from HEAD, or "" if none exist. */
function lastTag() {
  return git(["describe", "--tags", "--abbrev=0"]);
}

/**
 * Infer a changelog type from a commit subject's conventional-commit prefix.
 * feat->new, fix->fixed, perf/refactor->improved, anything else->improved.
 */
export function inferType(subject) {
  const m = /^([a-zA-Z]+)(\([^)]*\))?!?:/.exec(subject || "");
  const prefix = m ? m[1].toLowerCase() : "";
  if (prefix === "feat") return "new";
  if (prefix === "fix") return "fixed";
  if (prefix === "perf" || prefix === "refactor") return "improved";
  return "improved";
}

/**
 * Parse a full commit message (subject + body) for the Changelog trailers.
 * Returns { text, type } or null when no `Changelog:` trailer is present.
 * The trailer value may span continuation lines until a blank line or another
 * trailer key.
 */
export function parseCommit(subject, body) {
  const lines = String(body || "").split("\n");
  let text = null;
  let explicitType = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    const changelogMatch = /^Changelog:\s*(.*)$/i.exec(trimmed);
    if (changelogMatch) {
      const parts = [changelogMatch[1].trim()];
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j].trim();
        if (next === "" || /^[A-Za-z-]+:\s/.test(next)) break;
        parts.push(next);
      }
      text = parts.join(" ").trim();
      continue;
    }

    const typeMatch = /^Changelog-type:\s*(\w+)$/i.exec(trimmed);
    if (typeMatch) {
      const t = typeMatch[1].toLowerCase();
      if (VALID_TYPES.has(t)) explicitType = t;
    }
  }

  if (!text) return null;
  return { text, type: explicitType || inferType(subject) };
}

/**
 * Parse raw `git log` output (formatted with FIELD/RECORD separators) into an
 * array of { text, type } changes. Exported for unit testing without git.
 */
export function parseLog(out) {
  if (!out) return [];
  const records = out
    .split(RECORD)
    .map((r) => r.replace(/^\s+/, ""))
    .filter((r) => r.trim() !== "");

  const changes = [];
  for (const rec of records) {
    const sepIndex = rec.indexOf(FIELD);
    const subject = sepIndex === -1 ? rec : rec.slice(0, sepIndex);
    const body = sepIndex === -1 ? "" : rec.slice(sepIndex + 1);
    const parsed = parseCommit(subject.trim(), body);
    if (parsed) changes.push(parsed);
  }
  return changes;
}

/**
 * Compute/replace the current version's entry in changelog.json. Exported so
 * tests can exercise the idempotent merge without touching disk.
 */
export function applyChanges(data, version, changes, today) {
  if (!Array.isArray(data.entries)) data.entries = [];
  const existing = data.entries.find((e) => e.version === version);

  if (existing) {
    // Idempotent: replace this version's auto-collected changes, keeping
    // human-edited fields (title/summary/date/link). Only overwrite when the
    // extractor actually found trailers — this protects hand-curated or
    // seeded `changes` for versions whose commits predate the trailer
    // convention (re-running on such a version is a no-op).
    if (changes.length > 0) {
      existing.changes = changes;
    }
    if (!existing.date) existing.date = today;
  } else {
    // New version: auto-fill changes, leave title/summary as editable
    // placeholders for the human reviewer in the release PR.
    data.entries.unshift({
      version,
      date: today,
      title: `Release ${version}`,
      summary: "",
      changes,
      link: {
        label: "Technical details",
        url: `https://github.com/ReadySet1/ready-set/releases/tag/v${version}`,
      },
    });
  }
  return data;
}

/** Collect changes from a git range (or full history when range is ""). */
function collectChanges(range) {
  const args = ["log", "--format=%s%x1f%b%x1e"];
  if (range) args.push(range);
  return parseLog(git(args));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function main() {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const version = pkg.version;
  if (!version) {
    console.error("No version found in package.json");
    process.exit(1);
  }

  const tag = lastTag();
  const range = tag ? `${tag}..HEAD` : "";
  let changes = collectChanges(range);

  // Fall back to full history if the range yielded nothing (fresh repo,
  // tag === HEAD, or detached state).
  if (changes.length === 0 && range) {
    changes = collectChanges("");
  }

  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  applyChanges(data, version, changes, todayIso());

  writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
  console.log(
    `changelog: version ${version} - ${changes.length} change(s) from ${
      range || "full history"
    }`,
  );
}

// Only run when invoked directly (not when imported by tests). Resolve
// symlinks on both sides so paths match even under /tmp -> /private/tmp.
function realPath(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
const invokedDirectly =
  process.argv[1] &&
  realPath(resolve(process.argv[1])) ===
    realPath(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main();
}
