import { getPromotionDates } from '../dates';

describe('dates', () => {
  describe('getPromotionDates', () => {
    // Store original Date
    const RealDate = Date;

    beforeAll(() => {
      // Mock Date to return a fixed date (January 15, 2024)
      const mockDate = new Date('2024-01-15T12:00:00Z');
      global.Date = class extends RealDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(mockDate.getTime());
            return this;
          }
          // @ts-ignore
          super(...args);
        }

        static now() {
          return mockDate.getTime();
        }
      } as DateConstructor;
    });

    afterAll(() => {
      global.Date = RealDate;
    });

    it('should return startDate as first of the month', () => {
      const result = getPromotionDates();

      // Should be January 1, 2024
      expect(result.startDate).toContain('January');
      expect(result.startDate).toContain('1');
      expect(result.startDate).toContain('2024');
    });

    it('should return endDate as last of the month', () => {
      const result = getPromotionDates();

      // Should be January 31, 2024
      expect(result.endDate).toContain('January');
      expect(result.endDate).toContain('31');
      expect(result.endDate).toContain('2024');
    });

    it('should return formatted display string', () => {
      const result = getPromotionDates();

      // Should be "January 1 to 31, 2024"
      expect(result.formattedDisplay).toContain('January');
      expect(result.formattedDisplay).toContain('1');
      expect(result.formattedDisplay).toContain('31');
      expect(result.formattedDisplay).toContain('2024');
    });

    it('should have all required properties', () => {
      const result = getPromotionDates();

      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('endDate');
      expect(result).toHaveProperty('formattedDisplay');
    });

    it('should return strings for all properties', () => {
      const result = getPromotionDates();

      expect(typeof result.startDate).toBe('string');
      expect(typeof result.endDate).toBe('string');
      expect(typeof result.formattedDisplay).toBe('string');
    });
  });
});
