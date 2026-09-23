/**
 * @jest-environment node
 */
import type { MemorySnapshot } from '../alerting';

const MB = 1024 * 1024;
const GB = 1024 * MB;

type AlertingModule = typeof import('../alerting');

function loadAlerting(): AlertingModule {
  let mod: AlertingModule | undefined;
  jest.isolateModules(() => {
    mod = require('../alerting');
  });
  return mod as AlertingModule;
}

function memoryAlerts(mod: AlertingModule) {
  return mod.getActiveAlerts().filter((a) => a.type === mod.AlertType.RESOURCE_EXHAUSTION);
}

function snapshot(overrides: Partial<MemorySnapshot> = {}): MemorySnapshot {
  return {
    heapUsed: 280 * MB,
    heapTotal: 300 * MB, // ~93% of heapTotal: the old metric fired on this
    heapLimit: 4 * GB,
    rss: 400 * MB,
    external: 10 * MB,
    cgroupLimit: 2 * GB,
    ...overrides,
  };
}

const MONITOR_KEY = Symbol.for('readyset.alerting.monitoringInterval');
const STORE_KEY = Symbol.for('readyset.alerting.alertStore');
const NO_LIMIT_WARNED_KEY = Symbol.for('readyset.alerting.memoryNoLimitWarned');

function resetProcessState() {
  const g = globalThis as Record<symbol, unknown>;
  delete g[STORE_KEY];
  delete g[NO_LIMIT_WARNED_KEY];
}

describe('monitorMemoryUsage', () => {
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    resetProcessState();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('does not alert on a healthy process even when heapUsed is close to heapTotal', () => {
    const mod = loadAlerting();
    mod.monitorMemoryUsage(snapshot());
    expect(memoryAlerts(mod)).toHaveLength(0);
  });

  it('alerts when the heap approaches the V8 heap size limit', () => {
    const mod = loadAlerting();
    mod.monitorMemoryUsage(snapshot({ heapUsed: 3.9 * GB, heapTotal: 3.95 * GB }));

    const alerts = memoryAlerts(mod);
    expect(alerts).toHaveLength(1);
    const alert = alerts[0]!;
    expect(alert.severity).toBe(mod.AlertSeverity.CRITICAL);
    expect(alert.title).toBe('High Memory Usage');
    expect(alert.data.usagePercentage).toBeCloseTo(97.5, 1);
    expect(alert.data.heapUsagePercentage).toBeCloseTo(97.5, 1);
    expect(alert.data.rssUsagePercentage).toBeCloseTo(19.53, 1);
    expect(alert.data.memoryUsage).toEqual(
      expect.objectContaining({ used: '3993.60 MB', total: '4096.00 MB', rss: '400.00 MB', cgroupLimit: '2048.00 MB' })
    );
  });

  it('alerts when RSS approaches the cgroup memory limit', () => {
    const mod = loadAlerting();
    mod.monitorMemoryUsage(snapshot({ rss: 1.8 * GB }));

    const alerts = memoryAlerts(mod);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.severity).toBe(mod.AlertSeverity.WARNING);
    expect(alerts[0]!.data.rssUsagePercentage).toBeCloseTo(90, 1);
  });

  it('only uses the heap figure when the cgroup limit is unknown', () => {
    const mod = loadAlerting();
    expect(() => mod.monitorMemoryUsage(snapshot({ cgroupLimit: null, rss: 50 * GB }))).not.toThrow();
    expect(memoryAlerts(mod)).toHaveLength(0);
  });

  it('warns once when neither a heap nor a cgroup limit is available', () => {
    const mod = loadAlerting();
    const noLimits = snapshot({ heapLimit: null, cgroupLimit: null });
    mod.monitorMemoryUsage(noLimits);
    mod.monitorMemoryUsage(noLimits);
    // A second module copy in the same process must not warn again either.
    loadAlerting().monitorMemoryUsage(noLimits);

    const disabledWarnings = warnSpy.mock.calls.filter((args) =>
      String(args[0]).includes('memory monitoring disabled: no heap or cgroup limit available')
    );
    expect(disabledWarnings).toHaveLength(1);
    expect(memoryAlerts(mod)).toHaveLength(0);
  });

  it('does not warn about disabled monitoring when a limit is known', () => {
    const mod = loadAlerting();
    mod.monitorMemoryUsage(snapshot({ cgroupLimit: null }));
    expect(
      warnSpy.mock.calls.some((args) => String(args[0]).includes('memory monitoring disabled'))
    ).toBe(false);
  });

  it('does nothing when no snapshot can be taken', () => {
    const mod = loadAlerting();
    expect(() => mod.monitorMemoryUsage(null)).not.toThrow();
    expect(memoryAlerts(mod)).toHaveLength(0);
  });
});

describe('readCgroupMemoryLimit', () => {
  const mod = loadAlerting();

  it('reads the cgroup v2 limit', () => {
    const read = (p: string) => {
      if (p === '/sys/fs/cgroup/memory.max') return '2147483648\n';
      throw new Error('ENOENT');
    };
    expect(mod.readCgroupMemoryLimit(read)).toBe(2 * GB);
  });

  it('falls back to the cgroup v1 limit', () => {
    const read = (p: string) => {
      if (p === '/sys/fs/cgroup/memory/memory.limit_in_bytes') return '1073741824';
      throw new Error('ENOENT');
    };
    expect(mod.readCgroupMemoryLimit(read)).toBe(1 * GB);
  });

  it('treats "max" and the v1 unlimited sentinel as no limit', () => {
    expect(mod.readCgroupMemoryLimit(() => 'max\n')).toBeNull();
    expect(mod.readCgroupMemoryLimit(() => '9223372036854771712')).toBeNull();
  });

  it('returns null when the cgroup files are unreadable', () => {
    const read = () => {
      throw new Error('EACCES');
    };
    expect(() => mod.readCgroupMemoryLimit(read)).not.toThrow();
    expect(mod.readCgroupMemoryLimit(read)).toBeNull();
  });
});

describe('monitoring schedule', () => {
  const clearSchedule = () => {
    const g = globalThis as Record<symbol, unknown>;
    const handle = g[MONITOR_KEY] as ReturnType<typeof setInterval> | undefined;
    if (handle) clearInterval(handle);
    delete g[MONITOR_KEY];
  };

  beforeEach(clearSchedule);
  afterEach(clearSchedule);

  it('registers a single interval per process even when the module is evaluated twice', () => {
    const spy = jest.spyOn(global, 'setInterval');
    try {
      loadAlerting();
      loadAlerting();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('alert store', () => {
  beforeEach(resetProcessState);

  it('is shared by every copy of the module in the process', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const writer = loadAlerting();
      const reader = loadAlerting();
      writer.monitorMemoryUsage(snapshot({ heapUsed: 3.9 * GB }));

      const seen = reader
        .getActiveAlerts()
        .filter((a) => a.type === reader.AlertType.RESOURCE_EXHAUSTION);
      expect(seen).toHaveLength(1);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
