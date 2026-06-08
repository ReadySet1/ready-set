import { formatDuration, formatDurationShort, formatTime } from "../format";

describe("driver format helpers", () => {
  describe("formatDuration", () => {
    it("formats H:MM:SS over an hour", () => {
      expect(formatDuration(3 * 3600 + 12 * 60 + 5)).toBe("3:12:05");
    });
    it("formats M:SS under an hour", () => {
      expect(formatDuration(65)).toBe("1:05");
    });
    it("clamps negatives to zero", () => {
      expect(formatDuration(-50)).toBe("0:00");
    });
  });

  describe("formatDurationShort", () => {
    it("formats hours + minutes", () => {
      expect(formatDurationShort(3 * 3600 + 12 * 60)).toBe("3h 12m");
    });
    it("formats minutes only under an hour", () => {
      expect(formatDurationShort(45 * 60)).toBe("45m");
    });
  });

  describe("formatTime", () => {
    it("returns empty string for nullish/invalid input", () => {
      expect(formatTime(null)).toBe("");
      expect(formatTime(undefined)).toBe("");
      expect(formatTime("not-a-date")).toBe("");
    });
    it("formats a valid date to a time string", () => {
      const result = formatTime(new Date("2026-06-05T09:05:00"));
      expect(result).toMatch(/9:05/);
    });
  });
});
