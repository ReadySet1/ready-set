import { hasDeletedAtFilter } from '../soft-delete-extension';

// We test the extension logic by importing and calling createSoftDeleteExtension
// with different SOFT_DELETE_MODE values and verifying the query config behavior.

describe('hasDeletedAtFilter', () => {
  it('returns false for undefined', () => {
    expect(hasDeletedAtFilter(undefined)).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasDeletedAtFilter(null)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(hasDeletedAtFilter({})).toBe(false);
  });

  it('returns false when deletedAt is not present', () => {
    expect(hasDeletedAtFilter({ type: 'DRIVER', status: 'ACTIVE' })).toBe(false);
  });

  it('returns true when deletedAt: null is present', () => {
    expect(hasDeletedAtFilter({ deletedAt: null })).toBe(true);
  });

  it('returns true when deletedAt: { not: null } is present', () => {
    expect(hasDeletedAtFilter({ deletedAt: { not: null } })).toBe(true);
  });

  it('returns true when deletedAt has any value', () => {
    expect(hasDeletedAtFilter({ deletedAt: new Date() })).toBe(true);
  });

  it('returns true when deletedAt is among other fields', () => {
    expect(
      hasDeletedAtFilter({ type: 'ADMIN', deletedAt: null, status: 'ACTIVE' })
    ).toBe(true);
  });
});

describe('createSoftDeleteExtension', () => {
  const originalEnv = process.env.SOFT_DELETE_MODE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SOFT_DELETE_MODE;
    } else {
      process.env.SOFT_DELETE_MODE = originalEnv;
    }
    jest.resetModules();
  });

  it('creates extension in enforce mode by default', () => {
    delete process.env.SOFT_DELETE_MODE;
    // Re-import to pick up fresh env
    const { createSoftDeleteExtension } = require('../soft-delete-extension');
    const ext = createSoftDeleteExtension();
    expect(ext).toBeDefined();
    // The extension should have a name
    expect(ext.name).toBe('soft-delete');
  });

  it('creates extension in log mode', () => {
    process.env.SOFT_DELETE_MODE = 'log';
    const { createSoftDeleteExtension } = require('../soft-delete-extension');
    const ext = createSoftDeleteExtension();
    expect(ext).toBeDefined();
    expect(ext.name).toBe('soft-delete');
  });

  it('creates extension in off mode', () => {
    process.env.SOFT_DELETE_MODE = 'off';
    const { createSoftDeleteExtension } = require('../soft-delete-extension');
    const ext = createSoftDeleteExtension();
    expect(ext).toBeDefined();
  });
});

describe('Soft-delete extension query behavior', () => {
  const SOFT_DELETABLE_MODELS = [
    'profile',
    'address',
    'cateringRequest',
    'onDemand',
    'jobApplication',
    'driver',
    'driverLocation',
    'driverShift',
    'delivery',
  ];

  const READ_OPERATIONS = [
    'findMany',
    'findFirst',
    'findFirstOrThrow',
    'count',
    'aggregate',
    'groupBy',
  ];

  describe('enforce mode', () => {
    let extension: any;

    beforeAll(() => {
      process.env.SOFT_DELETE_MODE = 'enforce';
      jest.resetModules();
      const { createSoftDeleteExtension } = require('../soft-delete-extension');
      extension = createSoftDeleteExtension();
    });

    it('has query handlers for all soft-deletable models', () => {
      const queryConfig = extension.query;
      for (const model of SOFT_DELETABLE_MODELS) {
        expect(queryConfig).toHaveProperty(model);
      }
    });

    it('has handlers for all intercepted operations on each model', () => {
      const queryConfig = extension.query;
      const ALL_OPS = [...READ_OPERATIONS, 'findUnique', 'findUniqueOrThrow'];
      for (const model of SOFT_DELETABLE_MODELS) {
        for (const op of ALL_OPS) {
          expect(queryConfig[model]).toHaveProperty(op);
          expect(typeof queryConfig[model][op]).toBe('function');
        }
      }
    });

    it('does not have handlers for non-soft-deletable models', () => {
      const queryConfig = extension.query;
      expect(queryConfig).not.toHaveProperty('calculatorTemplate');
      expect(queryConfig).not.toHaveProperty('pricingRule');
      expect(queryConfig).not.toHaveProperty('fileUpload');
    });
  });

  describe('enforce mode — filter injection', () => {
    let queryHandlers: Record<string, Record<string, (...args: any[]) => any>>;

    beforeAll(() => {
      process.env.SOFT_DELETE_MODE = 'enforce';
      jest.resetModules();
      const { createSoftDeleteExtension } = require('../soft-delete-extension');
      const ext = createSoftDeleteExtension();
      queryHandlers = ext.query;
    });

    for (const op of ['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy']) {
      it(`injects deletedAt: null for profile.${op} when not present`, async () => {
        const mockQuery = jest.fn().mockResolvedValue([]);
        const handler = queryHandlers.profile[op];

        await handler({ args: { where: { type: 'DRIVER' } }, query: mockQuery });

        expect(mockQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ type: 'DRIVER', deletedAt: null }),
          })
        );
      });

      it(`does not double-filter for profile.${op} when deletedAt: null already present`, async () => {
        const mockQuery = jest.fn().mockResolvedValue([]);
        const handler = queryHandlers.profile[op];

        await handler({
          args: { where: { type: 'ADMIN', deletedAt: null } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: { type: 'ADMIN', deletedAt: null },
        });
      });

      it(`does not override explicit deletedAt: { not: null } for profile.${op}`, async () => {
        const mockQuery = jest.fn().mockResolvedValue([]);
        const handler = queryHandlers.profile[op];

        await handler({
          args: { where: { deletedAt: { not: null } } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: { deletedAt: { not: null } },
        });
      });
    }

    it('injects deletedAt: null when where is undefined', async () => {
      const mockQuery = jest.fn().mockResolvedValue([]);
      const handler = queryHandlers.profile.findMany;

      await handler({ args: {}, query: mockQuery });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        })
      );
    });

    it('injects deletedAt: null when args is undefined', async () => {
      const mockQuery = jest.fn().mockResolvedValue([]);
      const handler = queryHandlers.profile.findMany;

      await handler({ args: undefined, query: mockQuery });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        })
      );
    });

    it('works for all 9 soft-deletable models', async () => {
      for (const model of SOFT_DELETABLE_MODELS) {
        const mockQuery = jest.fn().mockResolvedValue([]);
        const handler = queryHandlers[model].findMany;

        await handler({ args: { where: {} }, query: mockQuery });

        expect(mockQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ deletedAt: null }),
          })
        );
      }
    });
  });

  describe('log mode — no injection, logs warning', () => {
    let queryHandlers: Record<string, Record<string, (...args: any[]) => any>>;
    let warnSpy: jest.SpyInstance;

    beforeAll(() => {
      process.env.SOFT_DELETE_MODE = 'log';
      jest.resetModules();
      const { createSoftDeleteExtension } = require('../soft-delete-extension');
      const ext = createSoftDeleteExtension();
      queryHandlers = ext.query;
    });

    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('does not inject filter but logs a warning', async () => {
      const mockQuery = jest.fn().mockResolvedValue([]);
      const handler = queryHandlers.profile.findMany;

      await handler({ args: { where: { type: 'DRIVER' } }, query: mockQuery });

      // Should pass through unchanged
      expect(mockQuery).toHaveBeenCalledWith({ where: { type: 'DRIVER' } });

      // Should log a warning
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SOFT_DELETE_AUDIT]'),
        expect.objectContaining({ model: 'Profile', operation: 'findMany' })
      );
    });

    it('does not log when deletedAt filter already present', async () => {
      const mockQuery = jest.fn().mockResolvedValue([]);
      const handler = queryHandlers.profile.findMany;

      await handler({
        args: { where: { deletedAt: null } },
        query: mockQuery,
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('off mode — passes through unchanged', () => {
    let queryHandlers: Record<string, Record<string, (...args: any[]) => any>>;

    beforeAll(() => {
      process.env.SOFT_DELETE_MODE = 'off';
      jest.resetModules();
      const { createSoftDeleteExtension } = require('../soft-delete-extension');
      const ext = createSoftDeleteExtension();
      queryHandlers = ext.query;
    });

    it('passes through without any modification', async () => {
      const mockQuery = jest.fn().mockResolvedValue([]);
      const handler = queryHandlers.profile.findMany;

      await handler({ args: { where: { type: 'ADMIN' } }, query: mockQuery });

      expect(mockQuery).toHaveBeenCalledWith({ where: { type: 'ADMIN' } });
    });
  });
});
