import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// The extractor is a zero-dep ESM module under scripts/. Load its exported
// helpers via dynamic import (path relative to this test file).
const scriptPath = resolve(__dirname, "../../../scripts/build-changelog.mjs");
// eslint-disable-next-line @typescript-eslint/no-var-requires
type Extractor = {
  inferType: (subject: string) => string;
  parseCommit: (
    subject: string,
    body: string,
  ) => { text: string; type: string } | null;
  parseLog: (out: string) => { text: string; type: string }[];
  applyChanges: (
    data: any,
    version: string,
    changes: any[],
    today: string,
  ) => any;
};

let mod: Extractor;

beforeAll(async () => {
  mod = (await import(scriptPath)) as unknown as Extractor;
});

describe("build-changelog extractor", () => {
  describe("inferType", () => {
    it("maps conventional prefixes (feat→new, fix→fixed, perf/refactor→improved)", () => {
      expect(mod.inferType("feat: x")).toBe("new");
      expect(mod.inferType("feat(scope)!: x")).toBe("new");
      expect(mod.inferType("fix: x")).toBe("fixed");
      expect(mod.inferType("perf: x")).toBe("improved");
      expect(mod.inferType("refactor: x")).toBe("improved");
      expect(mod.inferType("chore: x")).toBe("improved");
    });
  });

  describe("parseCommit", () => {
    it("returns null when no Changelog trailer is present", () => {
      expect(mod.parseCommit("docs: x", "just a body")).toBeNull();
    });

    it("uses an explicit Changelog-type when provided", () => {
      const r = mod.parseCommit(
        "feat: t",
        "body\n\nChangelog: Real-time tracking.\nChangelog-type: improved",
      );
      expect(r).toEqual({ text: "Real-time tracking.", type: "improved" });
    });

    it("infers the type from the subject when Changelog-type is absent", () => {
      const r = mod.parseCommit("fix: t", "Changelog: Squashed a bug.");
      expect(r).toEqual({ text: "Squashed a bug.", type: "fixed" });
    });
  });

  describe("parseLog", () => {
    it("collects only commits with trailers, preserving order", () => {
      const log =
        "feat: a\x1fChangelog: New thing.\x1e" +
        "docs: b\x1fno trailer\x1e" +
        "fix: c\x1fChangelog: Fixed thing.\nChangelog-type: fixed\x1e";
      expect(mod.parseLog(log)).toEqual([
        { text: "New thing.", type: "new" },
        { text: "Fixed thing.", type: "fixed" },
      ]);
    });
  });

  describe("applyChanges idempotency", () => {
    it("replaces (never duplicates) the current version's changes on re-run", () => {
      const data = { title: "t", subtitle: "s", entries: [] as any[] };
      const changes = [{ type: "new", text: "x" }];
      mod.applyChanges(data, "9.9.9", changes, "2026-01-01");
      mod.applyChanges(data, "9.9.9", changes, "2026-01-01");
      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].changes).toHaveLength(1);
    });

    it("does not clobber hand-curated changes when no trailers are found", () => {
      const data = {
        title: "t",
        subtitle: "s",
        entries: [
          {
            version: "1.0.0",
            date: "2026-01-01",
            title: "kept",
            summary: "kept",
            changes: [{ type: "new", text: "human-written" }],
          },
        ],
      };
      mod.applyChanges(data, "1.0.0", [], "2026-02-02");
      expect(data.entries[0].changes).toEqual([
        { type: "new", text: "human-written" },
      ]);
    });
  });

  describe("integration: run against a fixture git repo", () => {
    let dir: string;

    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), "changelog-extractor-"));
      const run = (args: string[]) =>
        execFileSync("git", args, { cwd: dir, stdio: "ignore" });

      run(["init", "-q"]);
      run(["config", "user.email", "test@example.com"]);
      run(["config", "user.name", "Test"]);
      run(["config", "commit.gpgsign", "false"]);
      run(["config", "core.hooksPath", "/dev/null"]);

      // package.json with the target version.
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture", version: "5.0.0" }) + "\n",
      );
      // Seed changelog.json.
      mkdirSync(join(dir, "src", "data"), { recursive: true });
      writeFileSync(
        join(dir, "src", "data", "changelog.json"),
        JSON.stringify({ title: "t", subtitle: "s", entries: [] }) + "\n",
      );
      // Copy the extractor script in.
      mkdirSync(join(dir, "scripts"), { recursive: true });
      writeFileSync(
        join(dir, "scripts", "build-changelog.mjs"),
        readFileSync(scriptPath, "utf8"),
      );

      run(["add", "."]);
      run([
        "commit",
        "-q",
        "-m",
        "feat: live tracking\n\nChangelog: Follow your driver live.",
      ]);
      // A commit with no trailer (should be ignored).
      writeFileSync(join(dir, "noop.txt"), "x");
      run(["add", "."]);
      run(["commit", "-q", "-m", "docs: update readme"]);
      // A commit with explicit type.
      writeFileSync(join(dir, "noop2.txt"), "x");
      run(["add", "."]);
      run([
        "commit",
        "-q",
        "-m",
        "chore: misc\n\nChangelog: Tidied things up.\nChangelog-type: improved",
      ]);
    });

    afterAll(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it("produces the expected changelog.json from the commit range", () => {
      execFileSync(
        process.execPath,
        [join(dir, "scripts", "build-changelog.mjs")],
        { cwd: dir, stdio: "pipe" },
      );

      const out = JSON.parse(
        readFileSync(join(dir, "src", "data", "changelog.json"), "utf8"),
      );
      expect(out.entries).toHaveLength(1);
      const entry = out.entries[0];
      expect(entry.version).toBe("5.0.0");
      expect(entry.changes).toEqual(
        expect.arrayContaining([
          { type: "new", text: "Follow your driver live." },
          { type: "improved", text: "Tidied things up." },
        ]),
      );
      expect(entry.changes).toHaveLength(2);
    });
  });
});
