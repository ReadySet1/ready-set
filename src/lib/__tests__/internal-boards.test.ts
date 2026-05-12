import {
  buildRelatedTasksByQaKey,
  buildQaSummaryByKey,
  parseDescription,
} from "@/lib/internal-boards";
import type { QaBoardData, TasksBoardData } from "@/types/internal-boards";

describe("buildRelatedTasksByQaKey", () => {
  it("returns empty object when no tasks have relatedQa", () => {
    const tasks: TasksBoardData["tasks"] = [
      { id: "a", status: "open", title: "Task A", owner: "x", source: "may4" },
      { id: "b", status: "new",  title: "Task B", owner: "x", source: "may11" },
    ];
    expect(buildRelatedTasksByQaKey(tasks)).toEqual({});
  });

  it("returns empty object for empty input", () => {
    expect(buildRelatedTasksByQaKey([])).toEqual({});
  });

  it("groups tasks by relatedQa key", () => {
    const tasks: TasksBoardData["tasks"] = [
      { id: "a", status: "open",     title: "Fix bug A", owner: "x", source: "qa", relatedQa: "REA-OMG-06" },
      { id: "b", status: "open",     title: "Fix bug B", owner: "y", source: "qa", relatedQa: "REA-OMG-07" },
      { id: "c", status: "progress", title: "Unrelated", owner: "z", source: "may11" },
    ];
    const result = buildRelatedTasksByQaKey(tasks);
    expect(Object.keys(result).sort()).toEqual(["REA-OMG-06", "REA-OMG-07"]);
    expect(result["REA-OMG-06"]).toEqual([{ id: "a", title: "Fix bug A", status: "open" }]);
    expect(result["REA-OMG-07"]).toEqual([{ id: "b", title: "Fix bug B", status: "open" }]);
  });

  it("groups multiple tasks under the same QA key", () => {
    const tasks: TasksBoardData["tasks"] = [
      { id: "a", status: "open", title: "Patch a", owner: "x", source: "qa", relatedQa: "REA-OMG-08" },
      { id: "b", status: "done", title: "Patch b", owner: "y", source: "qa", relatedQa: "REA-OMG-08" },
    ];
    const result = buildRelatedTasksByQaKey(tasks);
    expect(result["REA-OMG-08"]).toHaveLength(2);
    expect(result["REA-OMG-08"]?.[0]?.id).toBe("a");
    expect(result["REA-OMG-08"]?.[1]?.id).toBe("b");
  });
});

describe("buildQaSummaryByKey", () => {
  const baseData: QaBoardData = {
    source:    "test.csv",
    generated: "2026-05-11",
    total:     0,
    counts: {
      PASS: 0, "PARTIAL-FAIL": 0, FAIL: 0, BLOCKED: 0,
      "IN-PROGRESS": 0, "NOT-RUN": 0, SKIPPED: 0, UNKNOWN: 0,
    },
    verdictOrder: ["PASS", "FAIL", "NOT-RUN"],
    verdictLabel: {
      PASS: "Pass", "PARTIAL-FAIL": "Partial Fail", FAIL: "Fail",
      BLOCKED: "Blocked", "IN-PROGRESS": "In Progress", "NOT-RUN": "Not Run",
      SKIPPED: "Skipped", UNKNOWN: "Unknown",
    },
    tests: [],
  };

  it("returns empty object for no tests", () => {
    expect(buildQaSummaryByKey(baseData)).toEqual({});
  });

  it("maps test key to summary + human-readable verdict", () => {
    const data: QaBoardData = {
      ...baseData,
      tests: [
        {
          key: "REA-OMG-01", summary: "Happy path", description: "", status: "DONE",
          priority: "High", assignee: "", labels: [], components: [],
          folder: "QA", notes: "", verdict: "PASS", steps: [],
        },
        {
          key: "REA-OMG-02", summary: "Edge case", description: "", status: "DONE",
          priority: "Medium", assignee: "", labels: [], components: [],
          folder: "QA", notes: "", verdict: "FAIL", steps: [],
        },
      ],
    };
    const result = buildQaSummaryByKey(data);
    expect(result["REA-OMG-01"]).toEqual({ summary: "Happy path", verdict: "Pass" });
    expect(result["REA-OMG-02"]).toEqual({ summary: "Edge case", verdict: "Fail" });
  });

  it("falls back to raw verdict when verdictLabel is missing the entry", () => {
    const data: QaBoardData = {
      ...baseData,
      verdictLabel: { ...baseData.verdictLabel, PASS: undefined as unknown as string },
      tests: [{
        key: "REA-X", summary: "x", description: "", status: "DONE",
        priority: "Low", assignee: "", labels: [], components: [],
        folder: "QA", notes: "", verdict: "PASS", steps: [],
      }],
    };
    expect(buildQaSummaryByKey(data)["REA-X"]?.verdict).toBe("PASS");
  });
});

describe("parseDescription", () => {
  it("returns empty array for undefined or empty input", () => {
    expect(parseDescription(undefined)).toEqual([]);
    expect(parseDescription("")).toEqual([]);
  });

  it("returns a single text segment when no code tags are present", () => {
    expect(parseDescription("plain text")).toEqual([
      { kind: "text", value: "plain text" },
    ]);
  });

  it("splits text and code segments", () => {
    const result = parseDescription("see <code>file.ts</code> for details");
    expect(result).toEqual([
      { kind: "text", value: "see " },
      { kind: "code", value: "file.ts" },
      { kind: "text", value: " for details" },
    ]);
  });

  it("handles multiple code segments", () => {
    const result = parseDescription("<code>a</code> and <code>b</code>");
    expect(result).toEqual([
      { kind: "code", value: "a" },
      { kind: "text", value: " and " },
      { kind: "code", value: "b" },
    ]);
  });

  it("does NOT execute or pass through script tags — they are treated as plain text", () => {
    const malicious = 'safe <script>alert("xss")</script> end';
    const result = parseDescription(malicious);
    expect(result).toEqual([{ kind: "text", value: malicious }]);
    expect(result.every((s) => s.kind === "text" || s.kind === "code")).toBe(true);
  });

  it("does NOT pass through arbitrary tags as HTML — only <code> is structured", () => {
    const result = parseDescription("<b>bold</b> and <code>code</code>");
    expect(result).toEqual([
      { kind: "text", value: "<b>bold</b> and " },
      { kind: "code", value: "code" },
    ]);
  });
});
