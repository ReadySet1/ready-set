/**
 * Device clock-skew correction for location `recorded_at`.
 *
 * Bug (2026-10-08, rs-dev): an Android tester's phone clock ran ~3,648 s
 * behind, so every web-tracker point landed an hour in the past and fell
 * outside the shift window — only 10 of 90 points counted toward mileage.
 * The client now sends its own send time (`client_sent_at`); the server
 * estimates the device clock offset per request and shifts the fix time by it.
 */
import {
  CLOCK_SKEW_TOLERANCE_MS,
  resolveRecordedAt,
} from '../recorded-at';

const SERVER_NOW = Date.parse('2026-10-06T18:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

describe('resolveRecordedAt', () => {
  describe('device clock offset correction', () => {
    it('shifts a fix from a phone running ~1 h behind onto server time', () => {
      const skew = 3_648_000; // phone is 3,648 s behind
      const deviceNow = SERVER_NOW - skew;
      const fixDeviceMs = deviceNow - 2_000; // fix captured 2 s before send

      const result = resolveRecordedAt({
        timestamp: iso(fixDeviceMs),
        clientSentAt: deviceNow,
        serverNowMs: SERVER_NOW,
      });

      expect(result.clockOffsetMs).toBe(skew);
      expect(result.clockCorrected).toBe(true);
      expect(result.recordedAt).toBe(iso(SERVER_NOW - 2_000));
    });

    it('shifts a fix from a phone running ahead back onto server time', () => {
      const skew = -10 * 60_000; // phone is 10 min ahead
      const deviceNow = SERVER_NOW - skew;

      const result = resolveRecordedAt({
        timestamp: iso(deviceNow - 1_000),
        clientSentAt: deviceNow,
        serverNowMs: SERVER_NOW,
      });

      expect(result.clockOffsetMs).toBe(skew);
      expect(result.clockCorrected).toBe(true);
      expect(result.recordedAt).toBe(iso(SERVER_NOW - 1_000));
    });

    it('accepts client_sent_at as an ISO string too', () => {
      const deviceNow = SERVER_NOW - 3_600_000;
      const result = resolveRecordedAt({
        timestamp: iso(deviceNow - 5_000),
        clientSentAt: iso(deviceNow),
        serverNowMs: SERVER_NOW,
      });
      expect(result.recordedAt).toBe(iso(SERVER_NOW - 5_000));
    });
  });

  describe('offline queue replay', () => {
    it('keeps legitimately old points old and corrects them by the same offset, preserving order', () => {
      // Phone is 1 h behind AND was offline: three points captured 40, 30 and
      // 20 min before the reconnect flush, all sent in one flush.
      const skew = 3_600_000;
      const deviceSendTime = SERVER_NOW - skew;
      const capturedDevice = [40, 30, 20].map(
        (minAgo) => deviceSendTime - minAgo * 60_000,
      );

      const results = capturedDevice.map((ms, i) =>
        resolveRecordedAt({
          timestamp: iso(ms),
          // the flush trickles, so each request has its own send time
          clientSentAt: deviceSendTime + i * 1_000,
          serverNowMs: SERVER_NOW + i * 1_000,
        }),
      );

      expect(results.map((r) => r.recordedAt)).toEqual([
        iso(SERVER_NOW - 40 * 60_000),
        iso(SERVER_NOW - 30 * 60_000),
        iso(SERVER_NOW - 20 * 60_000),
      ]);
      // never collapsed onto "now"
      for (const r of results) {
        expect(Date.parse(r.recordedAt!)).toBeLessThan(SERVER_NOW - 19 * 60_000);
      }
    });

    it('does not touch old points from a phone with a correct clock', () => {
      const captured = SERVER_NOW - 45 * 60_000;
      const result = resolveRecordedAt({
        timestamp: iso(captured),
        clientSentAt: SERVER_NOW - 300, // 300 ms of network latency
        serverNowMs: SERVER_NOW,
      });
      expect(result.clockCorrected).toBe(false);
      expect(result.recordedAt).toBe(iso(captured));
    });
  });

  describe('tolerance boundary', () => {
    it(`does not correct an offset of exactly ${CLOCK_SKEW_TOLERANCE_MS} ms`, () => {
      const deviceNow = SERVER_NOW - CLOCK_SKEW_TOLERANCE_MS;
      const result = resolveRecordedAt({
        timestamp: iso(deviceNow - 1_000),
        clientSentAt: deviceNow,
        serverNowMs: SERVER_NOW,
      });
      expect(result.clockOffsetMs).toBe(CLOCK_SKEW_TOLERANCE_MS);
      expect(result.clockCorrected).toBe(false);
      expect(result.recordedAt).toBe(iso(deviceNow - 1_000));
    });

    it('corrects an offset just past the tolerance', () => {
      const deviceNow = SERVER_NOW - (CLOCK_SKEW_TOLERANCE_MS + 1);
      const result = resolveRecordedAt({
        timestamp: iso(deviceNow - 1_000),
        clientSentAt: deviceNow,
        serverNowMs: SERVER_NOW,
      });
      expect(result.clockCorrected).toBe(true);
      expect(result.recordedAt).toBe(iso(SERVER_NOW - 1_000));
    });

    it('applies the tolerance symmetrically to a clock running ahead', () => {
      const deviceNow = SERVER_NOW + CLOCK_SKEW_TOLERANCE_MS;
      const result = resolveRecordedAt({
        timestamp: iso(deviceNow - 1_000),
        clientSentAt: deviceNow,
        serverNowMs: SERVER_NOW,
      });
      expect(result.clockCorrected).toBe(false);
    });
  });

  describe('old clients without client_sent_at (backward compatibility)', () => {
    it('passes a plausible fix time through unchanged', () => {
      const ts = iso(SERVER_NOW - 5 * 60_000);
      const result = resolveRecordedAt({ timestamp: ts, serverNowMs: SERVER_NOW });
      expect(result).toEqual({
        recordedAt: ts,
        clockOffsetMs: null,
        clockCorrected: false,
      });
    });

    it('clamps a future fix time to server now', () => {
      const result = resolveRecordedAt({
        timestamp: iso(SERVER_NOW + 10 * 60_000),
        serverNowMs: SERVER_NOW,
      });
      expect(result.recordedAt).toBe(iso(SERVER_NOW));
    });

    it('clamps even a slightly-future fix time to server now', () => {
      const result = resolveRecordedAt({
        timestamp: iso(SERVER_NOW + 30_000),
        serverNowMs: SERVER_NOW,
      });
      expect(result.recordedAt).toBe(iso(SERVER_NOW));
    });

    it('falls back to DB NOW() (null) for a fix older than 24 h', () => {
      const result = resolveRecordedAt({
        timestamp: iso(SERVER_NOW - 25 * 60 * 60_000),
        serverNowMs: SERVER_NOW,
      });
      expect(result.recordedAt).toBeNull();
    });

    it('falls back to DB NOW() (null) for a garbage or missing timestamp', () => {
      expect(
        resolveRecordedAt({ timestamp: 'not-a-date', serverNowMs: SERVER_NOW }).recordedAt,
      ).toBeNull();
      expect(
        resolveRecordedAt({ timestamp: undefined, serverNowMs: SERVER_NOW }).recordedAt,
      ).toBeNull();
    });

    it('ignores a garbage client_sent_at and behaves like an old client', () => {
      const ts = iso(SERVER_NOW - 60_000);
      const result = resolveRecordedAt({
        timestamp: ts,
        clientSentAt: 'garbage',
        serverNowMs: SERVER_NOW,
      });
      expect(result).toEqual({
        recordedAt: ts,
        clockOffsetMs: null,
        clockCorrected: false,
      });
    });
  });

  describe('future clamp after correction', () => {
    it('clamps a corrected fix that still lands in the future', () => {
      // A fix stamped after the send time (bogus device data) would land past
      // server now once corrected — never store a future recorded_at.
      const deviceNow = SERVER_NOW - 3_600_000;
      const result = resolveRecordedAt({
        timestamp: iso(deviceNow + 5 * 60_000),
        clientSentAt: deviceNow,
        serverNowMs: SERVER_NOW,
      });
      expect(result.clockCorrected).toBe(true);
      expect(result.recordedAt).toBe(iso(SERVER_NOW));
    });
  });

  it('still reports the offset when the request carries no fix time (native bridge)', () => {
    const result = resolveRecordedAt({
      timestamp: undefined,
      clientSentAt: SERVER_NOW - 3_648_000,
      serverNowMs: SERVER_NOW,
    });
    expect(result).toEqual({
      recordedAt: null,
      clockOffsetMs: 3_648_000,
      clockCorrected: true,
    });
  });
});
