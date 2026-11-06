import {
  CLOCK_OFFSET_STABLE_MS,
  estimateClockOffsetMs,
  nextClockOffsetMs,
  shiftElapsedSeconds,
} from "../shift-clock";

// 2026-10-14 field report: shift started 17:31 CST (23:31Z) on an Android
// phone whose clock ran ~3,648 s behind the server (same tester as the
// 2026-10-06 GPS skew, PR #668).
const START_ISO = "2026-10-14T23:31:00.000Z";
const START_MS = Date.parse(START_ISO);
const DEVICE_SKEW_MS = -3_648_000; // device clock minus server clock

describe("shiftElapsedSeconds", () => {
  it("counts from the server start using the device clock when it is correct", () => {
    expect(shiftElapsedSeconds(START_ISO, START_MS + 125_000, 0)).toBe(125);
  });

  it("is stuck at 0 for a device clock an hour behind without an offset", () => {
    const deviceNow = START_MS + 120_000 + DEVICE_SKEW_MS;
    expect(shiftElapsedSeconds(START_ISO, deviceNow, 0)).toBe(0);
  });

  it("corrects a device clock an hour behind with the server offset", () => {
    const deviceNow = START_MS + 120_000 + DEVICE_SKEW_MS;
    expect(shiftElapsedSeconds(START_ISO, deviceNow, -DEVICE_SKEW_MS)).toBe(120);
  });

  it("accepts a Date start time", () => {
    expect(shiftElapsedSeconds(new Date(START_MS), START_MS + 61_000, 0)).toBe(61);
  });

  it("never goes negative", () => {
    expect(shiftElapsedSeconds(START_ISO, START_MS - 5_000, 0)).toBe(0);
  });

  it("returns 0 for a missing or unparseable start time", () => {
    expect(shiftElapsedSeconds(null, START_MS, 0)).toBe(0);
    expect(shiftElapsedSeconds(undefined, START_MS, 0)).toBe(0);
    expect(shiftElapsedSeconds("not a date", START_MS, 0)).toBe(0);
  });
});

describe("estimateClockOffsetMs", () => {
  it("measures server minus device at the request midpoint", () => {
    const serverNow = START_MS;
    const sentAt = START_MS + DEVICE_SKEW_MS - 200;
    const receivedAt = START_MS + DEVICE_SKEW_MS + 200;
    expect(estimateClockOffsetMs(serverNow, sentAt, receivedAt)).toBe(-DEVICE_SKEW_MS);
  });

  it("returns null when the server sent no usable time (old server)", () => {
    expect(estimateClockOffsetMs(undefined, 0, 10)).toBeNull();
    expect(estimateClockOffsetMs("nope", 0, 10)).toBeNull();
    expect(estimateClockOffsetMs(Number.NaN, 0, 10)).toBeNull();
  });
});

describe("nextClockOffsetMs", () => {
  it("adopts a measured offset beyond the stable band", () => {
    expect(nextClockOffsetMs(0, 3_648_000)).toBe(3_648_000);
  });

  it("keeps the previous offset for latency-sized changes (no timer jitter)", () => {
    expect(nextClockOffsetMs(0, CLOCK_OFFSET_STABLE_MS - 1)).toBe(0);
    expect(nextClockOffsetMs(3_648_000, 3_648_900)).toBe(3_648_000);
  });

  it("keeps the previous offset when nothing was measured", () => {
    expect(nextClockOffsetMs(3_648_000, null)).toBe(3_648_000);
  });
});
