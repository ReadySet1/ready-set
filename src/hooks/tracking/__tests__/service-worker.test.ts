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
  handlers.fetch!({ request, respondWith });
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

  it('queues a location POST that fails at network level and answers 202', async () => {
    // Real fetch consumes the request body before rejecting.
    const fetchMock = jest.fn(async (req: any) => {
      await req.text();
      throw new TypeError('Load failed');
    });
    const { handlers, stored } = loadServiceWorker(fetchMock);

    const respondWith = dispatchFetch(
      handlers,
      makeRequest({
        url: `${ORIGIN}/api/tracking/locations`,
        method: 'POST',
        body: '{"lat":1}',
      }),
    );

    expect(respondWith).toHaveBeenCalledTimes(1);
    const response = await respondWith.mock.calls[0][0];
    expect(response).toBeTruthy();
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ success: false, queued: true });
    expect(stored).toHaveLength(1);
    expect(stored[0].body).toBe('{"lat":1}');
  });

  it('still answers with a response when the offline queue cannot be written', async () => {
    const fetchMock = jest.fn(async () => {
      throw new TypeError('Load failed');
    });
    const { handlers, indexedDB } = loadServiceWorker(fetchMock);
    indexedDB.open = () => {
      throw new Error('IndexedDB unavailable');
    };

    const respondWith = dispatchFetch(
      handlers,
      makeRequest({ url: `${ORIGIN}/api/tracking/locations`, method: 'POST', body: '{}' }),
    );

    const response = await respondWith.mock.calls[0][0];
    expect(response).toBeTruthy();
    expect(response.status).toBe(503);
  });

  it('passes a 429 through without queuing it', async () => {
    const fetchMock = jest.fn(async () => new FakeResponse('{}', { status: 429 }));
    const { handlers, stored } = loadServiceWorker(fetchMock);

    const respondWith = dispatchFetch(
      handlers,
      makeRequest({ url: `${ORIGIN}/api/tracking/locations`, method: 'POST', body: '{}' }),
    );

    const response = await respondWith.mock.calls[0][0];
    expect(response.status).toBe(429);
    expect(stored).toHaveLength(0);
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
