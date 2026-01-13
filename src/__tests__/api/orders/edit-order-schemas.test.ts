// src/__tests__/api/orders/edit-order-schemas.test.ts
/**
 * Unit tests for order edit schemas and helper functions
 */

import {
  addressUpdateSchema,
  cateringUpdateSchema,
  onDemandUpdateSchema,
  isTerminalStatus,
  detectSignificantChanges,
  hasSignificantChanges,
  TERMINAL_STATUSES,
  SIGNIFICANT_CHANGE_FIELDS,
  type FieldChange,
} from '@/app/api/orders/[order_number]/schemas';

describe('Order Edit Schemas', () => {
  describe('addressUpdateSchema', () => {
    it('should validate a complete valid address', () => {
      const validAddress = {
        street1: '123 Main St',
        street2: 'Suite 100',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        county: 'San Francisco',
        locationNumber: 'A1',
        parkingLoading: 'Back entrance',
      };

      const result = addressUpdateSchema.safeParse(validAddress);
      expect(result.success).toBe(true);
    });

    it('should validate address with only required fields', () => {
      const minimalAddress = {
        street1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
      };

      const result = addressUpdateSchema.safeParse(minimalAddress);
      expect(result.success).toBe(true);
    });

    it('should reject address with missing street1', () => {
      const invalidAddress = {
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
      };

      const result = addressUpdateSchema.safeParse(invalidAddress);
      expect(result.success).toBe(false);
    });

    it('should reject address with missing city', () => {
      const invalidAddress = {
        street1: '123 Main St',
        state: 'CA',
        zip: '94102',
      };

      const result = addressUpdateSchema.safeParse(invalidAddress);
      expect(result.success).toBe(false);
    });

    it('should reject address with invalid state length', () => {
      const invalidAddress = {
        street1: '123 Main St',
        city: 'San Francisco',
        state: 'California', // Should be 2 characters
        zip: '94102',
      };

      const result = addressUpdateSchema.safeParse(invalidAddress);
      expect(result.success).toBe(false);
    });

    it('should reject address with invalid zip format', () => {
      const invalidAddress = {
        street1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '1234', // Invalid - too short
      };

      const result = addressUpdateSchema.safeParse(invalidAddress);
      expect(result.success).toBe(false);
    });

    it('should accept valid 5-digit zip code', () => {
      const address = {
        street1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
      };

      const result = addressUpdateSchema.safeParse(address);
      expect(result.success).toBe(true);
    });

    it('should accept valid zip+4 format', () => {
      const address = {
        street1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102-1234',
      };

      const result = addressUpdateSchema.safeParse(address);
      expect(result.success).toBe(true);
    });

    it('should allow optional latitude and longitude', () => {
      const address = {
        street1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        latitude: 37.7749,
        longitude: -122.4194,
      };

      const result = addressUpdateSchema.safeParse(address);
      expect(result.success).toBe(true);
    });
  });

  describe('cateringUpdateSchema', () => {
    it('should validate empty update (all optional)', () => {
      const result = cateringUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate valid catering update fields', () => {
      const validUpdate = {
        pickupDateTime: '2025-02-15T10:00:00Z',
        arrivalDateTime: '2025-02-15T11:00:00Z',
        brokerage: 'Test Brokerage',
        headcount: 50,
        needHost: 'YES',
        hoursNeeded: 4,
        numberOfHosts: 2,
        orderTotal: 500,
        tip: 50,
        appliedDiscount: 25,
        deliveryCost: 75,
        clientAttention: 'John Smith',
        pickupNotes: 'Back entrance',
        specialNotes: 'Handle with care',
      };

      const result = cateringUpdateSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should coerce date strings to Date objects', () => {
      const update = {
        pickupDateTime: '2025-02-15T10:00:00Z',
      };

      const result = cateringUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pickupDateTime).toBeInstanceOf(Date);
      }
    });

    it('should reject invalid needHost value', () => {
      const invalidUpdate = {
        needHost: 'MAYBE',
      };

      const result = cateringUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should reject negative orderTotal', () => {
      const invalidUpdate = {
        orderTotal: -100,
      };

      const result = cateringUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should reject negative headcount', () => {
      const invalidUpdate = {
        headcount: -5,
      };

      const result = cateringUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should allow nullable fields', () => {
      const update = {
        brokerage: null,
        headcount: null,
        hoursNeeded: null,
      };

      const result = cateringUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should validate nested pickup address', () => {
      const update = {
        pickupAddress: {
          street1: '123 Pickup St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
        },
      };

      const result = cateringUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should validate nested delivery address', () => {
      const update = {
        deliveryAddress: {
          street1: '456 Delivery Ave',
          city: 'Oakland',
          state: 'CA',
          zip: '94601',
        },
      };

      const result = cateringUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });
  });

  describe('onDemandUpdateSchema', () => {
    it('should validate empty update (all optional)', () => {
      const result = onDemandUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate valid on-demand update fields', () => {
      const validUpdate = {
        pickupDateTime: '2025-02-15T10:00:00Z',
        arrivalDateTime: '2025-02-15T11:00:00Z',
        itemDelivered: 'Medical supplies',
        vehicleType: 'VAN',
        hoursNeeded: 2,
        length: 24,
        width: 18,
        height: 12,
        weight: 50,
        orderTotal: 150,
        tip: 20,
        clientAttention: 'Jane Doe',
        pickupNotes: 'Call on arrival',
        specialNotes: 'Fragile',
      };

      const result = onDemandUpdateSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should accept valid vehicleType values', () => {
      const vehicleTypes = ['CAR', 'VAN', 'TRUCK'];

      vehicleTypes.forEach((type) => {
        const result = onDemandUpdateSchema.safeParse({ vehicleType: type });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid vehicleType', () => {
      const invalidUpdate = {
        vehicleType: 'HELICOPTER',
      };

      const result = onDemandUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should reject negative dimensions', () => {
      const invalidUpdate = {
        length: -10,
      };

      const result = onDemandUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should reject negative weight', () => {
      const invalidUpdate = {
        weight: -5,
      };

      const result = onDemandUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });
  });
});

describe('Helper Functions', () => {
  describe('isTerminalStatus', () => {
    it('should return true for COMPLETED status', () => {
      expect(isTerminalStatus('COMPLETED')).toBe(true);
    });

    it('should return true for DELIVERED status', () => {
      expect(isTerminalStatus('DELIVERED')).toBe(true);
    });

    it('should return true for CANCELLED status', () => {
      expect(isTerminalStatus('CANCELLED')).toBe(true);
    });

    it('should return false for ACTIVE status', () => {
      expect(isTerminalStatus('ACTIVE')).toBe(false);
    });

    it('should return false for PENDING status', () => {
      expect(isTerminalStatus('PENDING')).toBe(false);
    });

    it('should return false for ASSIGNED status', () => {
      expect(isTerminalStatus('ASSIGNED')).toBe(false);
    });

    it('should handle case-insensitive comparison', () => {
      expect(isTerminalStatus('completed')).toBe(true);
      expect(isTerminalStatus('Completed')).toBe(true);
      expect(isTerminalStatus('COMPLETED')).toBe(true);
    });
  });

  describe('detectSignificantChanges', () => {
    it('should detect change in pickupDateTime', () => {
      const before = {
        pickupDateTime: '2025-02-15T10:00:00Z',
        orderTotal: 100,
      };
      const after = {
        pickupDateTime: new Date('2025-02-15T14:00:00Z'),
      };

      const changes = detectSignificantChanges(before, after);

      expect(changes).toHaveLength(1);
      expect(changes[0].field).toBe('pickupDateTime');
      expect(changes[0].isSignificant).toBe(true);
    });

    it('should detect change in arrivalDateTime', () => {
      const before = {
        arrivalDateTime: '2025-02-15T11:00:00Z',
      };
      const after = {
        arrivalDateTime: new Date('2025-02-15T15:00:00Z'),
      };

      const changes = detectSignificantChanges(before, after);

      expect(changes).toHaveLength(1);
      expect(changes[0].field).toBe('arrivalDateTime');
      expect(changes[0].isSignificant).toBe(true);
    });

    it('should detect change in orderTotal', () => {
      const before = { orderTotal: 100 };
      const after = { orderTotal: 150 };

      const changes = detectSignificantChanges(before, after);

      expect(changes).toHaveLength(1);
      expect(changes[0].field).toBe('orderTotal');
      expect(changes[0].isSignificant).toBe(true);
    });

    it('should detect change in pickupAddress', () => {
      const before = {
        pickupAddress: {
          street1: '123 Old St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
        },
      };
      const after = {
        pickupAddress: {
          street1: '456 New St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
        },
      };

      const changes = detectSignificantChanges(before, after);

      expect(changes).toHaveLength(1);
      expect(changes[0].field).toBe('pickupAddress');
      expect(changes[0].isSignificant).toBe(true);
    });

    it('should mark non-significant fields as not significant', () => {
      const before = { clientAttention: 'John' };
      const after = { clientAttention: 'Jane' };

      const changes = detectSignificantChanges(before, after);

      expect(changes).toHaveLength(1);
      expect(changes[0].field).toBe('clientAttention');
      expect(changes[0].isSignificant).toBe(false);
    });

    it('should not detect change when value is the same', () => {
      const before = { orderTotal: 100 };
      const after = { orderTotal: 100 };

      const changes = detectSignificantChanges(before, after);

      expect(changes).toHaveLength(0);
    });

    it('should skip undefined values', () => {
      const before = { orderTotal: 100, tip: 10 };
      const after = { orderTotal: undefined };

      const changes = detectSignificantChanges(before, after);

      expect(changes).toHaveLength(0);
    });

    it('should detect multiple changes', () => {
      const before = {
        orderTotal: 100,
        tip: 10,
        pickupDateTime: '2025-02-15T10:00:00Z',
      };
      const after = {
        orderTotal: 150,
        tip: 15,
        pickupDateTime: new Date('2025-02-15T14:00:00Z'),
      };

      const changes = detectSignificantChanges(before, after);

      expect(changes).toHaveLength(3);
      expect(changes.filter((c) => c.isSignificant)).toHaveLength(2); // orderTotal and pickupDateTime
    });

    it('should handle Date comparison with string', () => {
      const dateStr = '2025-02-15T10:00:00Z';
      const before = { pickupDateTime: dateStr };
      const after = { pickupDateTime: new Date(dateStr) };

      const changes = detectSignificantChanges(before, after);

      // Same time, should not detect change
      expect(changes).toHaveLength(0);
    });
  });

  describe('hasSignificantChanges', () => {
    it('should return true when there are significant changes', () => {
      const changes: FieldChange[] = [
        { field: 'orderTotal', oldValue: 100, newValue: 150, isSignificant: true },
        { field: 'tip', oldValue: 10, newValue: 15, isSignificant: false },
      ];

      expect(hasSignificantChanges(changes)).toBe(true);
    });

    it('should return false when there are no significant changes', () => {
      const changes: FieldChange[] = [
        { field: 'tip', oldValue: 10, newValue: 15, isSignificant: false },
        { field: 'clientAttention', oldValue: 'John', newValue: 'Jane', isSignificant: false },
      ];

      expect(hasSignificantChanges(changes)).toBe(false);
    });

    it('should return false for empty changes array', () => {
      expect(hasSignificantChanges([])).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should have correct TERMINAL_STATUSES', () => {
      expect(TERMINAL_STATUSES).toContain('COMPLETED');
      expect(TERMINAL_STATUSES).toContain('DELIVERED');
      expect(TERMINAL_STATUSES).toContain('CANCELLED');
      expect(TERMINAL_STATUSES).toHaveLength(3);
    });

    it('should have correct SIGNIFICANT_CHANGE_FIELDS', () => {
      expect(SIGNIFICANT_CHANGE_FIELDS).toContain('pickupDateTime');
      expect(SIGNIFICANT_CHANGE_FIELDS).toContain('arrivalDateTime');
      expect(SIGNIFICANT_CHANGE_FIELDS).toContain('pickupAddress');
      expect(SIGNIFICANT_CHANGE_FIELDS).toContain('deliveryAddress');
      expect(SIGNIFICANT_CHANGE_FIELDS).toContain('orderTotal');
      expect(SIGNIFICANT_CHANGE_FIELDS).toHaveLength(5);
    });
  });
});
