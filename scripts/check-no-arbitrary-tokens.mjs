#!/usr/bin/env node
/**
 * Token guardrail (M4): scans for arbitrary hex colors and px spacing values
 * that should use semantic tokens from tailwind.config.ts instead.
 *
 * Two modes:
 *   default       — scan all src/ files, print violations, exit 0 (warn-only)
 *   --diff        — scan only files changed vs origin/development, exit 1 on any new violation
 *
 * Add new tokens to tailwind.config.ts (M3) before running with --diff.
 */

import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

const PATTERNS = [
  {
    name: "arbitrary-hex-color",
    regex: /(?:bg|text|border|ring|fill|stroke|from|to|via)-\[#[A-Fa-f0-9]{3,8}\]/g,
    hint: "Use a semantic color token (bg-brand, text-text-primary, bg-auth-tint, …) — see tailwind.config.ts.",
  },
  {
    name: "arbitrary-px-spacing",
    regex: /(?:pt|pb|pl|pr|p|mt|mb|ml|mr|m|px|py|mx|my|gap|min-h|max-h|min-w|max-w|w|h)-\[(?:\d+(?:\.\d+)?)px\]/g,
    hint: "Use a Tailwind spacing token (pt-page-y, min-h-card-h-md, …) — see tailwind.config.ts.",
  },
];

const SCAN_GLOB = ["src/"];
const VALID_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mdx"]);

function listAllFiles() {
  const out = execSync(
    `find ${SCAN_GLOB.join(" ")} -type f \\( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.mdx" \\)`,
    { encoding: "utf8" }
  );
  return out.split("\n").filter(Boolean);
}

function getDiffBase() {
  return process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : "origin/development";
}

function listDiffLines() {
  const base = getDiffBase();
  let out;
  try {
    out = execSync(`git diff --unified=0 --diff-filter=AM ${base}...HEAD`, {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch {
    out = execSync("git diff --unified=0 --diff-filter=AM HEAD~1", {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
  }

  const lines = out.split("\n");
  const added = []; // { file, line, content }
  const removed = []; // { file, content }
  let currentFile = null;
  let currentLineNum = 0;

  for (const ln of lines) {
    if (ln.startsWith("+++ b/")) {
      currentFile = ln.slice(6);
      continue;
    }
    if (ln.startsWith("--- ")) continue;
    const hunk = ln.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      currentLineNum = parseInt(hunk[1], 10);
      continue;
    }
    if (!currentFile) continue;
    if (!currentFile.startsWith("src/") || !VALID_EXT.has(extname(currentFile))) continue;
    if (ln.startsWith("+") && !ln.startsWith("+++")) {
      added.push({ file: currentFile, line: currentLineNum, content: ln.slice(1) });
      currentLineNum++;
    } else if (ln.startsWith("-") && !ln.startsWith("---")) {
      removed.push({ file: currentFile, content: ln.slice(1) });
    } else if (!ln.startsWith("\\")) {
      currentLineNum++;
    }
  }
  return { added, removed };
}

function buildPreservedSet(removedLines) {
  // For each file, collect all token-violation matches that EXISTED before the edit.
  // If the same violation appears in an added line, it was preserved (not new) — skip it.
  const preserved = new Map(); // file -> Set<"rule|match">
  for (const { file, content } of removedLines) {
    for (const { name, regex } of PATTERNS) {
      const matches = content.match(regex);
      if (matches) {
        const set = preserved.get(file) ?? new Set();
        for (const m of matches) set.add(`${name}|${m}`);
        preserved.set(file, set);
      }
    }
  }
  return preserved;
}

function fileExists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function scanFiles(files) {
  const violations = [];
  for (const file of files) {
    if (!fileExists(file)) continue;
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    for (const { name, regex, hint } of PATTERNS) {
      lines.forEach((line, i) => {
        const matches = line.match(regex);
        if (matches) {
          for (const match of matches) {
            violations.push({ file, line: i + 1, match, rule: name, hint });
          }
        }
      });
    }
  }
  return violations;
}

function scanLines(addedLines, preserved) {
  const violations = [];
  for (const { file, line, content } of addedLines) {
    for (const { name, regex, hint } of PATTERNS) {
      const matches = content.match(regex);
      if (matches) {
        const fileSet = preserved.get(file);
        for (const match of matches) {
          if (fileSet?.has(`${name}|${match}`)) continue; // preserved on edit, not new
          violations.push({ file, line, match, rule: name, hint });
        }
      }
    }
  }
  return violations;
}

function main() {
  const diffMode = process.argv.includes("--diff");

  let violations;
  let scope;
  if (diffMode) {
    const { added, removed } = listDiffLines();
    if (added.length === 0) {
      console.log("✓ No added lines to check.");
      process.exit(0);
    }
    const preserved = buildPreservedSet(removed);
    violations = scanLines(added, preserved);
    scope = `${added.length} added line(s)`;
  } else {
    const files = listAllFiles();
    violations = scanFiles(files);
    scope = `${files.length} file(s)`;
  }

  if (violations.length === 0) {
    console.log(`✓ No token violations in ${scope}.`);
    process.exit(0);
  }

  const grouped = new Map();
  for (const v of violations) {
    const list = grouped.get(v.rule) ?? [];
    list.push(v);
    grouped.set(v.rule, list);
  }

  const headline = diffMode
    ? `\n✗ ${violations.length} token violation(s) in changed files\n`
    : `\n⚠ ${violations.length} token violation(s) across codebase (warn-only)\n`;
  console.log(headline);

  for (const [rule, list] of grouped) {
    console.log(`  [${rule}] ${list.length} occurrence(s)`);
    console.log(`  hint: ${list[0].hint}`);
    for (const v of list.slice(0, 20)) {
      console.log(`    ${v.file}:${v.line}  ${v.match}`);
    }
    if (list.length > 20) {
      console.log(`    … and ${list.length - 20} more`);
    }
    console.log();
  }

  if (diffMode) {
    console.log(
      "These violations were introduced in the current diff. Replace with semantic tokens."
    );
    process.exit(1);
  }
  process.exit(0);
}

main();
