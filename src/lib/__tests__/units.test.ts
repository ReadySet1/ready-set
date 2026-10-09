import { formatMiles } from "../units";

// Product rule: user-facing distances are always imperial (feet/miles).
describe("formatMiles", () => {
  it("shows short distances in feet, rounded to 10 ft", () => {
    expect(formatMiles(0)).toBe("0 ft");
    expect(formatMiles(0.05)).toBe("260 ft");
  });

  it("switches to miles with one decimal from 1,000 ft", () => {
    expect(formatMiles(0.62)).toBe("0.6 mi");
    expect(formatMiles(12.345)).toBe("12.3 mi");
  });

  it("never renders metric units", () => {
    for (const miles of [0, 0.01, 0.2, 1, 9.99, 250]) {
      expect(formatMiles(miles)).not.toMatch(/\d\s?(m|km)\b/);
    }
  });
});
