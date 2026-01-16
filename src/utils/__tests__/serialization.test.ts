import { serializeBigInt } from '../serialization';

describe('serializeBigInt', () => {
  describe('basic types', () => {
    it('should pass through strings unchanged', () => {
      const result = serializeBigInt({ name: 'test' });
      expect(result.name).toBe('test');
    });

    it('should pass through numbers unchanged', () => {
      const result = serializeBigInt({ count: 42 });
      expect(result.count).toBe(42);
    });

    it('should pass through booleans unchanged', () => {
      const result = serializeBigInt({ active: true, disabled: false });
      expect(result.active).toBe(true);
      expect(result.disabled).toBe(false);
    });

    it('should pass through null unchanged', () => {
      const result = serializeBigInt({ value: null });
      expect(result.value).toBeNull();
    });

    it('should pass through undefined unchanged', () => {
      const result = serializeBigInt({ value: undefined });
      expect(result.value).toBeUndefined();
    });
  });

  describe('bigint conversion', () => {
    it('should convert bigint to string', () => {
      const result = serializeBigInt({ id: BigInt(12345) });
      expect(result.id).toBe('12345');
      expect(typeof result.id).toBe('string');
    });

    it('should convert large bigint to string', () => {
      const largeNumber = BigInt('9007199254740993'); // Larger than Number.MAX_SAFE_INTEGER
      const result = serializeBigInt({ id: largeNumber });
      expect(result.id).toBe('9007199254740993');
    });

    it('should convert negative bigint to string', () => {
      const result = serializeBigInt({ balance: BigInt(-1000) });
      expect(result.balance).toBe('-1000');
    });
  });

  describe('nested objects', () => {
    it('should recursively process nested objects', () => {
      const result = serializeBigInt({
        user: {
          id: BigInt(123),
          name: 'John',
        },
      });
      expect(result.user.id).toBe('123');
      expect(result.user.name).toBe('John');
    });

    it('should handle deeply nested objects', () => {
      const result = serializeBigInt({
        level1: {
          level2: {
            level3: {
              id: BigInt(456),
            },
          },
        },
      });
      expect(result.level1.level2.level3.id).toBe('456');
    });
  });

  describe('arrays', () => {
    it('should process arrays of primitive values', () => {
      const result = serializeBigInt({
        values: [1, 2, 3],
      });
      expect(result.values).toEqual([1, 2, 3]);
    });

    it('should process arrays of objects', () => {
      const result = serializeBigInt({
        users: [
          { id: BigInt(1), name: 'Alice' },
          { id: BigInt(2), name: 'Bob' },
        ],
      });
      expect(result.users[0].id).toBe('1');
      expect(result.users[0].name).toBe('Alice');
      expect(result.users[1].id).toBe('2');
      expect(result.users[1].name).toBe('Bob');
    });

    it('should handle mixed arrays', () => {
      const result = serializeBigInt({
        mixed: ['string', 42, { id: BigInt(100) }],
      });
      expect(result.mixed[0]).toBe('string');
      expect(result.mixed[1]).toBe(42);
      expect(result.mixed[2].id).toBe('100');
    });

    it('should handle empty arrays', () => {
      const result = serializeBigInt({ items: [] });
      expect(result.items).toEqual([]);
    });
  });

  describe('complex objects', () => {
    it('should handle complex nested structure', () => {
      const input = {
        organization: {
          id: BigInt(1),
          name: 'Acme Corp',
          departments: [
            {
              id: BigInt(10),
              name: 'Engineering',
              employees: [
                { id: BigInt(100), name: 'Alice', salary: BigInt(100000) },
                { id: BigInt(101), name: 'Bob', salary: BigInt(90000) },
              ],
            },
          ],
          metadata: {
            founded: BigInt(1990),
            active: true,
          },
        },
      };

      const result = serializeBigInt(input);

      expect(result.organization.id).toBe('1');
      expect(result.organization.name).toBe('Acme Corp');
      expect(result.organization.departments[0].id).toBe('10');
      expect(result.organization.departments[0].employees[0].id).toBe('100');
      expect(result.organization.departments[0].employees[0].salary).toBe('100000');
      expect(result.organization.metadata.founded).toBe('1990');
      expect(result.organization.metadata.active).toBe(true);
    });

    it('should handle empty object', () => {
      const result = serializeBigInt({});
      expect(result).toEqual({});
    });
  });
});
