/**
 * Durable outbox for GPS fixes captured without connectivity (board card
 * gps-points-lost-during-data-outage).
 *
 * 2026-10-17, Guillermo (Android wrapper): ~5 min without mobile data left a
 * 294 s hole in shift c8f2f0f2 and none of the missing fixes ever reached the
 * server. The outbox is the one queue both the web tracker and the native
 * bridge write to; it must keep every fix of a long outage, survive a reload,
 * and replay oldest-first in batches once the network is back.
 */
import type { LocationUpdate } from '@/types/tracking';
import { MemoryLocationStore } from '@/__tests__/helpers/memory-location-store';

type Outbox = typeof import('../location-outbox');

const DRIVER_ID = '9fb029c7-1ed1-46ea-94f6-f45ad435bbee';
const T0 = Date.parse('2026-10-17T21:24:00Z');

function fixAt(ms: number, i = 0): LocationUpdate {
  return {
    driverId: DRIVER_ID,
    coordinates: { lat: 21.1 + i * 0.0001, lng: -101.6 },
    accuracy: 2,
    speed: 8,
    heading: 270,
    batteryLevel: 40.4,
    activityType: 'driving',
    isMoving: true,
    timestamp: new Date(ms),
  };
}

function loadOutbox(): Outbox {
  let mod!: Outbox;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('../location-outbox');
  });
  return mod;
}

describe('location outbox', () => {
  let store: MemoryLocationStore;
  let outbox: Outbox;
  let now: number;

  beforeEach(() => {
    store = new MemoryLocationStore();
    outbox = loadOutbox();
    now = T0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    (Date.now as jest.Mock).mockRestore();
  });

  /** Simulates an outage: one fix every `everyMs` for `minutes`, all failing to send. */
  async function outage(minutes: number, everyMs = 5_000) {
    const count = Math.floor((minutes * 60_000) / everyMs);
    for (let i = 0; i < count; i++) {
      now = T0 + i * everyMs;
      await outbox.enqueueLocation(fixAt(now, i), store);
    }
    return count;
  }

  it('keeps every fix of a 30-minute outage', async () => {
    const count = await outage(30);

    expect(count).toBe(360);
    expect(store.pendingTimestamps()).toHaveLength(360);
  });

  it('replays the backlog oldest-first, in batches, with the original fix times', async () => {
    await outage(10);
    now += 60_000;
    const send = jest.fn().mockResolvedValue({ ok: true, status: 201 });

    const result = await outbox.flushLocationOutbox(send, store);

    expect(result).toMatchObject({ sent: 120, remaining: 0 });
    expect(send.mock.calls.length).toBe(Math.ceil(120 / outbox.OUTBOX_BATCH_SIZE));
    const sentTimes = send.mock.calls.flatMap(([, points]) => points.map((p: any) => p.timestamp));
    expect(sentTimes).toHaveLength(120);
    expect(sentTimes[0]).toBe(new Date(T0).toISOString());
    expect(sentTimes).toEqual([...sentTimes].sort());
    expect(send.mock.calls.every(([driverId]) => driverId === DRIVER_ID)).toBe(true);
    expect(store.pendingTimestamps()).toHaveLength(0);
  });

  it('sends the payload the batch route expects', async () => {
    await outbox.enqueueLocation(fixAt(T0), store);
    const send = jest.fn().mockResolvedValue({ ok: true, status: 201 });

    await outbox.flushLocationOutbox(send, store);

    expect(send.mock.calls[0]![1][0]).toEqual({
      latitude: 21.1,
      longitude: -101.6,
      accuracy: 2,
      speed: 8,
      heading: 270,
      altitude: undefined,
      battery_level: 40,
      is_moving: true,
      timestamp: new Date(T0).toISOString(),
    });
  });

  it('caps the backlog by dropping the oldest fixes', async () => {
    const cap = outbox.OUTBOX_MAX_POINTS;
    for (let i = 0; i < cap + 25; i++) {
      now = T0 + i * 1_000;
      await outbox.enqueueLocation(fixAt(now, i), store);
    }

    const pending = store.pendingTimestamps();
    expect(pending).toHaveLength(cap);
    expect(pending[0]).toBe(new Date(T0 + 25 * 1_000).toISOString());
    expect(pending[pending.length - 1]).toBe(new Date(T0 + (cap + 24) * 1_000).toISOString());
  });

  it('discards fixes too old for the server to file, without sending them', async () => {
    await outbox.enqueueLocation(fixAt(T0), store);
    now = T0 + outbox.OUTBOX_MAX_AGE_MS + 1;
    await outbox.enqueueLocation(fixAt(now), store);
    const send = jest.fn().mockResolvedValue({ ok: true, status: 201 });

    await outbox.flushLocationOutbox(send, store);

    const sentTimes = send.mock.calls.flatMap(([, points]) => points.map((p: any) => p.timestamp));
    expect(sentTimes).toEqual([new Date(now).toISOString()]);
    expect(store.pendingTimestamps()).toHaveLength(0);
  });

  it('keeps the backlog when the network is still down', async () => {
    await outage(5);
    const send = jest.fn().mockResolvedValue({ ok: false });

    const result = await outbox.flushLocationOutbox(send, store);

    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ sent: 0, remaining: 60, stoppedBy: 'network' });
    expect(store.pendingTimestamps()).toHaveLength(60);
  });

  it('stops on a server error and resumes where it left off', async () => {
    await outage(10);
    const send = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 201 })
      .mockResolvedValueOnce({ ok: false, status: 503 });

    const first = await outbox.flushLocationOutbox(send, store);
    expect(first).toMatchObject({ sent: outbox.OUTBOX_BATCH_SIZE, remaining: 120 - outbox.OUTBOX_BATCH_SIZE });

    send.mockReset().mockResolvedValue({ ok: true, status: 201 });
    const second = await outbox.flushLocationOutbox(send, store);
    expect(second.remaining).toBe(0);
    const resumedAt = send.mock.calls[0]![1][0].timestamp;
    expect(resumedAt).toBe(new Date(T0 + outbox.OUTBOX_BATCH_SIZE * 5_000).toISOString());
  });

  it('backs off after a 429 and leaves the queue intact', async () => {
    await outage(2);
    const send = jest.fn().mockResolvedValue({ ok: false, status: 429 });

    const first = await outbox.flushLocationOutbox(send, store);
    expect(first.stoppedBy).toBe('rate-limit');

    send.mockReset().mockResolvedValue({ ok: true, status: 201 });
    const gated = await outbox.flushLocationOutbox(send, store);
    expect(gated.stoppedBy).toBe('backoff');
    expect(send).not.toHaveBeenCalled();

    now += outbox.OUTBOX_429_BACKOFF_MS + 1;
    const after = await outbox.flushLocationOutbox(send, store);
    expect(after.remaining).toBe(0);
  });

  it('drops a batch the server refuses as malformed (400) so it cannot block the queue', async () => {
    await outage(1);
    const send = jest.fn().mockResolvedValue({ ok: false, status: 400 });

    const result = await outbox.flushLocationOutbox(send, store);

    expect(result.remaining).toBe(0);
  });

  it('keeps the backlog on 401/403 so it can go once the session heals', async () => {
    await outage(1);
    const send = jest.fn().mockResolvedValue({ ok: false, status: 401 });

    const result = await outbox.flushLocationOutbox(send, store);

    expect(result).toMatchObject({ remaining: 12, stoppedBy: 'auth' });
  });

  it('never runs two flushes at once (web tracker + native bridge share the queue)', async () => {
    await outage(1);
    let release!: () => void;
    const send = jest.fn(
      () => new Promise<{ ok: boolean; status: number }>((r) => (release = () => r({ ok: true, status: 201 }))),
    );

    const a = outbox.flushLocationOutbox(send, store);
    const b = await outbox.flushLocationOutbox(send, store);
    expect(b.stoppedBy).toBe('in-flight');
    await Promise.resolve();
    release();
    await a;

    expect(send).toHaveBeenCalledTimes(1);
    expect(store.pendingTimestamps()).toHaveLength(0);
  });

  it('counts a fix queued while a flush is running, so the next flushIfPending sends it', async () => {
    await outbox.enqueueLocation(fixAt(T0), store);
    let release!: () => void;
    const send = jest.fn(
      () => new Promise<{ ok: boolean; status: number }>((r) => (release = () => r({ ok: true, status: 201 }))),
    );

    const running = outbox.flushLocationOutbox(send, store);
    await Promise.resolve();
    await outbox.enqueueLocation(fixAt(T0 + 5_000, 1), store);
    release();
    await running;

    send.mockReset().mockResolvedValue({ ok: true, status: 201 });
    const next = await outbox.flushIfPending(send, store);
    expect(next).toMatchObject({ sent: 1, remaining: 0 });
  });

  it('survives a page reload: a fresh outbox instance replays what the previous one queued', async () => {
    await outage(3);
    const reloaded = loadOutbox();
    const send = jest.fn().mockResolvedValue({ ok: true, status: 201 });

    expect(await reloaded.flushIfPending(send, store)).toMatchObject({ sent: 36, remaining: 0 });
  });

  it('flushIfPending skips the store read once it knows the queue is empty', async () => {
    const send = jest.fn().mockResolvedValue({ ok: true, status: 201 });
    const spy = jest.spyOn(store, 'getUnsyncedLocations');

    await outbox.flushIfPending(send, store);
    await outbox.flushIfPending(send, store);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();

    await outbox.enqueueLocation(fixAt(T0), store);
    await outbox.flushIfPending(send, store);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('enqueue reports the pending count and never throws when storage fails', async () => {
    expect(await outbox.enqueueLocation(fixAt(T0), store)).toBe(1);
    store.failWrites = true;
    await expect(outbox.enqueueLocation(fixAt(T0 + 5_000), store)).resolves.toBe(1);
  });

  describe('createBatchSender', () => {
    const fetchMock = jest.fn();
    beforeEach(() => {
      fetchMock.mockReset();
      global.fetch = fetchMock as unknown as typeof fetch;
    });

    it('POSTs to the batch route with the device send time and the given headers', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 201 });
      const send = outbox.createBatchSender(async () => ({ Authorization: 'Bearer t' }));

      const result = await send(DRIVER_ID, [{ latitude: 1, longitude: 2, timestamp: 'x' }]);

      expect(result).toEqual({ ok: true, status: 201 });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('/api/tracking/locations/batch');
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer t' });
      expect(JSON.parse(init.body)).toEqual({
        driver_id: DRIVER_ID,
        client_sent_at: now,
        points: [{ latitude: 1, longitude: 2, timestamp: 'x' }],
      });
    });

    it('reports a network failure without a status', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      const send = outbox.createBatchSender(async () => ({}));

      expect(await send(DRIVER_ID, [])).toEqual({ ok: false });
    });

    describe('a hung upload', () => {
      /** fetch that never answers on its own; it only rejects when its signal aborts. */
      function hangingFetch() {
        fetchMock.mockImplementation(
          (_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) => {
              init.signal?.addEventListener('abort', () =>
                reject(init.signal?.reason ?? new DOMException('Aborted', 'AbortError')),
              );
            }),
        );
      }

      beforeEach(() => {
        // Date.now is already pinned by the outer beforeEach.
        jest.useFakeTimers({ doNotFake: ['Date', 'performance'] });
      });
      afterEach(() => {
        jest.useRealTimers();
      });

      async function settleAfter(promise: Promise<unknown>, ms: number) {
        let settled = false;
        void promise.then(() => {
          settled = true;
        });
        await jest.advanceTimersByTimeAsync(ms - 1);
        const early = settled;
        await jest.advanceTimersByTimeAsync(1);
        return { early, settled };
      }

      it('gives up after OUTBOX_BATCH_TIMEOUT_MS and reports a network failure', async () => {
        hangingFetch();
        const send = outbox.createBatchSender(async () => ({}));

        const pending = send(DRIVER_ID, []);
        const { early, settled } = await settleAfter(pending, outbox.OUTBOX_BATCH_TIMEOUT_MS);

        expect(early).toBe(false);
        expect(settled).toBe(true);
        expect(await pending).toEqual({ ok: false });
        expect(fetchMock.mock.calls[0]![1].signal).toBeDefined();
      });

      it('also times out on WebViews without AbortSignal.timeout', async () => {
        const original = AbortSignal.timeout;
        // @ts-expect-error simulate an older WebView
        delete AbortSignal.timeout;
        try {
          hangingFetch();
          const send = outbox.createBatchSender(async () => ({}));

          const pending = send(DRIVER_ID, []);
          const { early, settled } = await settleAfter(pending, outbox.OUTBOX_BATCH_TIMEOUT_MS);

          expect(early).toBe(false);
          expect(settled).toBe(true);
          expect(await pending).toEqual({ ok: false });
        } finally {
          AbortSignal.timeout = original;
        }
      });

      it('keeps the rows queued and lets a later flush run', async () => {
        await outbox.enqueueLocation(fixAt(T0), store);
        await outbox.enqueueLocation(fixAt(T0 + 5_000, 1), store);
        hangingFetch();
        const send = outbox.createBatchSender(async () => ({}));

        const first = outbox.flushLocationOutbox(send, store);
        await jest.advanceTimersByTimeAsync(outbox.OUTBOX_BATCH_TIMEOUT_MS);
        expect(await first).toEqual({ sent: 0, remaining: 2, stoppedBy: 'network' });
        expect(await store.getUnsyncedLocations()).toHaveLength(2);

        fetchMock.mockReset();
        fetchMock.mockResolvedValue({ ok: true, status: 201 });
        expect(await outbox.flushLocationOutbox(send, store)).toEqual({ sent: 2, remaining: 0 });
      });
    });

    it('reports 401 without calling the network when there are no credentials', async () => {
      const send = outbox.createBatchSender(async () => null);

      expect(await send(DRIVER_ID, [])).toEqual({ ok: false, status: 401 });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
