/**
 * @jest-environment node
 */
/**
 * Behaviour tests for public/service-worker.js.
 *
 * The SW is a plain script, so it is evaluated in an isolated vm context with
 * a fake `self` that captures the registered event handlers. Fakes for fetch,
 * caches and IndexedDB are injected so nothing leaks from jest.setup's global
 * Request/Response mocks.
 */
import { readFileSync } from 'fs';
import path from 'path';
import vm from 'vm';

type Handler = (event: any) => void;

const SW_SOURCE = readFileSync(path.join(process.cwd(), 'public', 'service-worker.js'), 'utf8');

class FakeResponse {
  status: number;
  ok: boolean;
  body: string | null;
  constructor(body: string | null = null, init: { status?: number } = {}) {
    this.body = body;
    this.status = init.status ?? 200;
    this.ok = this.status >= 200 && this.status < 300;
  }
  clone() {
    return new FakeResponse(this.body, { status: this.status });
  }
  async json() {
    return JSON.parse(this.body ?? 'null');
  }
}

function makeRequest(opts: { url: string; method?: string; mode?: string; body?: string }) {
  let bodyUsed = false;
  const body = opts.body ?? '';
  const req: any = {
    url: opts.url,
    method: opts.method ?? 'GET',
    mode: opts.mode ?? 'cors',
    headers: new Map([['content-type', 'application/json']]),
    get bodyUsed() {
      return bodyUsed;
    },
    async text() {
      if (bodyUsed) throw new TypeError('Body has already been consumed.');
      bodyUsed = true;
      return body;
    },
    clone() {
      if (bodyUsed) throw new TypeError('Body has already been consumed.');
      return makeRequest(opts);
    },
  };
  return req;
}

function makeIndexedDb() {
  const stored: any[] = [];
  const indexedDB = {
    open: () => {
      const openReq: any = {};
      setTimeout(() => {
        const store = {
          add: (record: any) => stored.push(record),
          getAll: () => {
            const r: any = {};
            setTimeout(() => {
              r.result = stored.slice();
              r.onsuccess?.();
            }, 0);
            return r;
          },
          delete: () => undefined,
        };
        const tx: any = { objectStore: () => store };
        openReq.result = {
          objectStoreNames: { contains: () => true },
          transaction: () => {
            setTimeout(() => tx.oncomplete?.(), 0);
            return tx;
          },
        };
        openReq.onsuccess?.();
      }, 0);
      return openReq;
    },
  };
  return { indexedDB, stored };
}

function loadServiceWorker(fetchImpl: jest.Mock) {
  const handlers: Record<string, Handler> = {};
  const self = {
    location: { origin: 'https://development.readysetllc.com' },
    addEventListener: (type: string, handler: Handler) => {
      handlers[type] = handler;
    },
    skipWaiting: jest.fn(() => Promise.resolve()),
    clients: { claim: jest.fn(() => Promise.resolve()) },
  };
  const caches = {
    open: jest.fn(() => Promise.resolve({ addAll: jest.fn(() => Promise.resolve()), put: jest.fn() })),
    match: jest.fn(() => Promise.resolve(undefined)),
    keys: jest.fn(() => Promise.resolve(['readyset-driver-v1'])),
    delete: jest.fn(() => Promise.resolve(true)),
  };
  const { indexedDB, stored } = makeIndexedDb();
  const context = vm.createContext({
    self,
    caches,
    indexedDB,
    fetch: fetchImpl,
    Response: FakeResponse,
    URL,
    console: { log: () => undefined, error: () => undefined, warn: () => undefined },
    setTimeout,
    Promise,
    JSON,
    Date,
    Math,
    Object,
    Error,
  });
  vm.runInContext(SW_SOURCE, context);
  return { handlers, caches, stored, self, indexedDB };
}

function dispatchFetch(handlers: Record<string, Handler>, request: any) {
  const respondWith = jest.fn();
  // No fetch listener at all means the browser never routes a request here.
  handlers.fetch?.({ request, respondWith });
  return respondWith;
}

const ORIGIN = 'https://development.readysetllc.com';

describe('public/service-worker.js', () => {
  it('does not intercept navigations, API GETs or assets', () => {
    const fetchMock = jest.fn();
    const { handlers } = loadServiceWorker(fetchMock);

    const requests = [
      makeRequest({ url: `${ORIGIN}/driver/tracking`, mode: 'navigate' }),
      makeRequest({ url: `${ORIGIN}/api/auth/session` }),
      makeRequest({ url: `${ORIGIN}/api/tracking/shifts/start`, method: 'POST', body: '{}' }),
      makeRequest({ url: `${ORIGIN}/_next/static/chunks/main.js` }),
      // GET on the location endpoint is not the offline-queue path either.
      makeRequest({ url: `${ORIGIN}/api/tracking/locations` }),
      // Cross-origin POST that happens to share the path.
      makeRequest({ url: 'https://evil.example.com/api/tracking/locations', method: 'POST' }),
    ];

    for (const req of requests) {
      expect(dispatchFetch(handlers, req)).not.toHaveBeenCalled();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not intercept location POSTs: the page owns the offline queue', () => {
    // 2026-10-17: the SW answered a failed location POST with a synthetic 202
    // and queued it in its own store, which it only replays on a Background
    // Sync event. Android WebView (the native wrapper) and iOS Safari never
    // fire one, so every fix of a 5-minute outage was lost, and the page
    // believed the 202 meant "saved" and never queued them itself.
    const fetchMock = jest.fn();
    const { handlers } = loadServiceWorker(fetchMock);

    const respondWith = dispatchFetch(
      handlers,
      makeRequest({ url: `${ORIGIN}/api/tracking/locations`, method: 'POST', body: '{"lat":1}' }),
    );

    expect(respondWith).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drains a legacy queued fix only while the server can still file it', async () => {
    const fetchMock = jest.fn(async () => new FakeResponse('{}', { status: 201 }));
    const { handlers, stored } = loadServiceWorker(fetchMock);
    const now = Date.now();
    stored.push(
      { id: 1, url: `${ORIGIN}/api/tracking/locations`, method: 'POST', headers: {}, body: '{"old":1}', timestamp: now - 25 * 60 * 60 * 1000 },
      { id: 2, url: `${ORIGIN}/api/tracking/locations`, method: 'POST', headers: {}, body: '{"recent":1}', timestamp: now - 60 * 1000 },
    );

    let work: Promise<unknown> | undefined;
    handlers.sync!({ tag: 'location-sync', waitUntil: (p: Promise<unknown>) => (work = p) });
    await work;

    // Replaying a >24 h fix would be stamped NOW() by the server and shown as
    // the driver's current position — it is discarded unsent.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown[])[1]).toMatchObject({ body: '{"recent":1}' });
  });

  it('does not precache /driver/tracking and drops the old v1 cache on activate', async () => {
    const { handlers, caches } = loadServiceWorker(jest.fn());

    let installWork: Promise<unknown> | undefined;
    handlers.install!({ waitUntil: (p: Promise<unknown>) => (installWork = p) });
    await installWork;
    const cache = await (caches.open as jest.Mock).mock.results[0]?.value;
    if (cache) {
      const precached = (cache.addAll as jest.Mock).mock.calls.flat(2);
      expect(precached).not.toContain('/driver/tracking');
    }
    expect((caches.open as jest.Mock).mock.calls.flat()).not.toContain('readyset-driver-v1');

    let activateWork: Promise<unknown> | undefined;
    handlers.activate!({ waitUntil: (p: Promise<unknown>) => (activateWork = p) });
    await activateWork;
    expect(caches.delete).toHaveBeenCalledWith('readyset-driver-v1');
  });
});
