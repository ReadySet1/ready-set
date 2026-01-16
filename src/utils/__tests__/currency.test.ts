import { formatCurrency, toNumber, withCurrencySymbol } from '../currency';

describe('currency', () => {
  describe('formatCurrency', () => {
    it('should format a number with 2 decimal places', () => {
      expect(formatCurrency(10)).toBe('10.00');
      expect(formatCurrency(10.5)).toBe('10.50');
      expect(formatCurrency(10.556)).toBe('10.56'); // rounds up
    });

    it('should format a string number with 2 decimal places', () => {
      expect(formatCurrency('10')).toBe('10.00');
      expect(formatCurrency('10.5')).toBe('10.50');
      expect(formatCurrency('99.999')).toBe('100.00');
    });

    it('should handle Decimal-like objects with toFixed method', () => {
      const decimal = { toFixed: (digits: number) => (250.50).toFixed(digits) };
      expect(formatCurrency(decimal)).toBe('250.50');
    });

    it('should return default value for null', () => {
      expect(formatCurrency(null)).toBe('0.00');
    });

    it('should return default value for undefined', () => {
      expect(formatCurrency(undefined)).toBe('0.00');
    });

    it('should return custom default value when provided', () => {
      expect(formatCurrency(null, 'N/A')).toBe('N/A');
      expect(formatCurrency(undefined, '--')).toBe('--');
    });

    it('should return default value for invalid string', () => {
      expect(formatCurrency('not-a-number')).toBe('0.00');
      expect(formatCurrency('abc')).toBe('0.00');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('0.00');
      expect(formatCurrency('0')).toBe('0.00');
    });

    it('should handle negative numbers', () => {
      expect(formatCurrency(-10.50)).toBe('-10.50');
      expect(formatCurrency('-25.75')).toBe('-25.75');
    });

    it('should handle large numbers', () => {
      expect(formatCurrency(1000000.99)).toBe('1000000.99');
    });
  });

  describe('toNumber', () => {
    it('should convert a number to itself', () => {
      expect(toNumber(10)).toBe(10);
      expect(toNumber(10.5)).toBe(10.5);
    });

    it('should convert a string to number', () => {
      expect(toNumber('10')).toBe(10);
      expect(toNumber('10.5')).toBe(10.5);
      expect(toNumber('99.999')).toBe(99.999);
    });

    it('should handle Decimal-like objects with toFixed method', () => {
      const decimal = { toFixed: (digits: number) => (250.50).toFixed(digits) };
      expect(toNumber(decimal)).toBe(250.5);
    });

    it('should return default value for null', () => {
      expect(toNumber(null)).toBe(0);
    });

    it('should return default value for undefined', () => {
      expect(toNumber(undefined)).toBe(0);
    });

    it('should return custom default value when provided', () => {
      expect(toNumber(null, -1)).toBe(-1);
      expect(toNumber(undefined, 100)).toBe(100);
    });

    it('should return default value for invalid string', () => {
      expect(toNumber('not-a-number')).toBe(0);
      expect(toNumber('abc')).toBe(0);
    });

    it('should handle zero', () => {
      expect(toNumber(0)).toBe(0);
      expect(toNumber('0')).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(toNumber(-10.50)).toBe(-10.5);
      expect(toNumber('-25.75')).toBe(-25.75);
    });
  });

  describe('withCurrencySymbol', () => {
    it('should add default $ symbol', () => {
      expect(withCurrencySymbol('10.00')).toBe('$10.00');
      expect(withCurrencySymbol('0.00')).toBe('$0.00');
    });

    it('should add custom currency symbol', () => {
      expect(withCurrencySymbol('10.00', '€')).toBe('€10.00');
      expect(withCurrencySymbol('10.00', '£')).toBe('£10.00');
      expect(withCurrencySymbol('10.00', '¥')).toBe('¥10.00');
    });

    it('should handle empty string', () => {
      expect(withCurrencySymbol('')).toBe('$');
    });

    it('should handle multi-character symbols', () => {
      expect(withCurrencySymbol('10.00', 'USD ')).toBe('USD 10.00');
    });
  });
});
