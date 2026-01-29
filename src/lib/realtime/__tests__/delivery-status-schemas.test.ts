/**
 * Unit tests for Delivery Status Zod Schemas
 *
 * Tests validation of delivery status payloads including
 * size limits, input sanitization, and field validation.
 */

import {
  DeliveryStatusPayloadSchema,
  DeliveryStatusUpdatedPayloadSchema,
  DeliveryTrackingStatusSchema,
  OrderTypeSchema,
  validatePayload,
  validatePayloadSize,
  MAX_PAYLOAD_SIZE,
  PayloadValidationError,
  PayloadSizeError,
} from '../schemas';
import { REALTIME_EVENTS } from '../types';

describe('DeliveryTrackingStatusSchema', () => {
  const validStatuses = [
    'ASSIGNED',
    'ARRIVED_AT_VENDOR',
    'PICKED_UP',
    'EN_ROUTE_TO_CLIENT',
    'ARRIVED_TO_CLIENT',
    'COMPLETED',
  ];

  it.each(validStatuses)('should accept valid status: %s', (status) => {
    const result = DeliveryTrackingStatusSchema.safeParse(status);
    expect(result.success).toBe(true);
  });

  it('should reject invalid status values', () => {
    const invalidStatuses = [
      'PENDING',
      'IN_PROGRESS',
      'CANCELLED',
      'invalid',
      '',
      null,
      undefined,
      123,
    ];

    invalidStatuses.forEach((status) => {
      const result = DeliveryTrackingStatusSchema.safeParse(status);
      expect(result.success).toBe(false);
    });
  });
});

describe('OrderTypeSchema', () => {
  it('should accept "catering" as valid order type', () => {
    const result = OrderTypeSchema.safeParse('catering');
    expect(result.success).toBe(true);
  });

  it('should accept "on_demand" as valid order type', () => {
    const result = OrderTypeSchema.safeParse('on_demand');
    expect(result.success).toBe(true);
  });

  it('should reject invalid order types', () => {
    const invalidTypes = ['delivery', 'pickup', 'express', '', null, undefined];

    invalidTypes.forEach((type) => {
      const result = OrderTypeSchema.safeParse(type);
      expect(result.success).toBe(false);
    });
  });
});

describe('DeliveryStatusPayloadSchema', () => {
  const createValidPayload = (overrides = {}) => ({
    orderId: '123e4567-e89b-12d3-a456-426614174000',
    orderNumber: 'ORD-12345',
    orderType: 'catering',
    driverId: '223e4567-e89b-12d3-a456-426614174001',
    status: 'EN_ROUTE_TO_CLIENT',
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  describe('valid payloads', () => {
    it('should accept valid DeliveryStatusPayload with required fields', () => {
      const payload = createValidPayload();
      const result = DeliveryStatusPayloadSchema.safeParse(payload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderId).toBe(payload.orderId);
        expect(result.data.orderNumber).toBe(payload.orderNumber);
        expect(result.data.orderType).toBe(payload.orderType);
        expect(result.data.driverId).toBe(payload.driverId);
        expect(result.data.status).toBe(payload.status);
      }
    });

    it('should accept valid payload with optional deliveryId', () => {
      const payload = createValidPayload({
        deliveryId: '323e4567-e89b-12d3-a456-426614174002',
      });
      const result = DeliveryStatusPayloadSchema.safeParse(payload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deliveryId).toBe('323e4567-e89b-12d3-a456-426614174002');
      }
    });

    it('should accept valid payload with optional previousStatus', () => {
      const payload = createValidPayload({
        previousStatus: 'PICKED_UP',
      });
      const result = DeliveryStatusPayloadSchema.safeParse(payload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.previousStatus).toBe('PICKED_UP');
      }
    });

    it('should accept both catering and on_demand order types', () => {
      const cateringResult = DeliveryStatusPayloadSchema.safeParse(
        createValidPayload({ orderType: 'catering' })
      );
      const onDemandResult = DeliveryStatusPayloadSchema.safeParse(
        createValidPayload({ orderType: 'on_demand' })
      );

      expect(cateringResult.success).toBe(true);
      expect(onDemandResult.success).toBe(true);
    });
  });

  describe('invalid payloads', () => {
    it('should reject invalid orderId (not UUID)', () => {
      const payload = createValidPayload({ orderId: 'not-a-uuid' });
      const result = DeliveryStatusPayloadSchema.safeParse(payload);

      expect(result.success).toBe(false);
    });

    it('should reject invalid driverId (not UUID)', () => {
      const payload = createValidPayload({ driverId: 'invalid-driver-id' });
      const result = DeliveryStatusPayloadSchema.safeParse(payload);

      expect(result.success).toBe(false);
    });

    it('should reject invalid deliveryId when provided', () => {
      const payload = createValidPayload({ deliveryId: 'not-uuid' });
      const result = DeliveryStatusPayloadSchema.safeParse(payload);

      expect(result.success).toBe(false);
    });

    it('should reject invalid status value', () => {
      const payload = createValidPayload({ status: 'INVALID_STATUS' });
      const result = DeliveryStatusPayloadSchema.safeParse(payload);

      expect(result.success).toBe(false);
    });

    it('should reject invalid orderType', () => {
      const payload = createValidPayload({ orderType: 'invalid_type' });
      const result = DeliveryStatusPayloadSchema.safeParse(payload);

      expect(result.success).toBe(false);
    });

    it('should reject invalid timestamp format', () => {
      const payload = createValidPayload({ timestamp: 'not-a-timestamp' });
      const result = DeliveryStatusPayloadSchema.safeParse(payload);

      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const requiredFields = ['orderId', 'orderNumber', 'orderType', 'driverId', 'status', 'timestamp'];

      requiredFields.forEach((field) => {
        const payload = createValidPayload();
        delete (payload as any)[field];
        const result = DeliveryStatusPayloadSchema.safeParse(payload);

        expect(result.success).toBe(false);
      });
    });

    it('should reject empty orderNumber', () => {
      const payload = createValidPayload({ orderNumber: '' });
      const result = DeliveryStatusPayloadSchema.safeParse(payload);

      expect(result.success).toBe(false);
    });

    it('should reject invalid previousStatus when provided', () => {
      const payload = createValidPayload({ previousStatus: 'INVALID' });
      const result = DeliveryStatusPayloadSchema.safeParse(payload);

      expect(result.success).toBe(false);
    });
  });
});

describe('DeliveryStatusUpdatedPayloadSchema', () => {
  const createValidPayload = (overrides = {}) => ({
    orderId: '123e4567-e89b-12d3-a456-426614174000',
    orderNumber: 'ORD-12345',
    orderType: 'catering',
    driverId: '223e4567-e89b-12d3-a456-426614174001',
    status: 'EN_ROUTE_TO_CLIENT',
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  it('should accept valid payload with optional driverName', () => {
    const payload = createValidPayload({ driverName: 'John Doe' });
    const result = DeliveryStatusUpdatedPayloadSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.driverName).toBe('John Doe');
    }
  });

  it('should accept valid payload with optional estimatedArrival', () => {
    const estimatedArrival = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const payload = createValidPayload({ estimatedArrival });
    const result = DeliveryStatusUpdatedPayloadSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.estimatedArrival).toBe(estimatedArrival);
    }
  });

  it('should accept all fields combined', () => {
    const payload = createValidPayload({
      deliveryId: '323e4567-e89b-12d3-a456-426614174002',
      previousStatus: 'PICKED_UP',
      driverName: 'Jane Smith',
      estimatedArrival: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const result = DeliveryStatusUpdatedPayloadSchema.safeParse(payload);

    expect(result.success).toBe(true);
  });

  it('should reject invalid estimatedArrival format', () => {
    const payload = createValidPayload({ estimatedArrival: 'in 30 minutes' });
    const result = DeliveryStatusUpdatedPayloadSchema.safeParse(payload);

    expect(result.success).toBe(false);
  });
});

describe('validatePayloadSize', () => {
  it('should accept payload within size limit', () => {
    const payload = {
      orderId: '123e4567-e89b-12d3-a456-426614174000',
      status: 'EN_ROUTE_TO_CLIENT',
    };

    expect(() => validatePayloadSize(payload, 'test-event')).not.toThrow();
  });

  it('should throw PayloadSizeError for oversized payload', () => {
    // Create a payload larger than MAX_PAYLOAD_SIZE (64KB)
    const largePayload = {
      data: 'x'.repeat(MAX_PAYLOAD_SIZE + 1000),
    };

    expect(() => validatePayloadSize(largePayload, 'test-event')).toThrow(PayloadSizeError);
  });

  it('should include size details in PayloadSizeError', () => {
    const largePayload = {
      data: 'x'.repeat(MAX_PAYLOAD_SIZE + 1000),
    };

    try {
      validatePayloadSize(largePayload, 'test-event');
      fail('Expected PayloadSizeError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadSizeError);
      const sizeError = error as PayloadSizeError;
      expect(sizeError.eventName).toBe('test-event');
      expect(sizeError.maxSize).toBe(MAX_PAYLOAD_SIZE);
      expect(sizeError.size).toBeGreaterThan(MAX_PAYLOAD_SIZE);
    }
  });
});

describe('validatePayload', () => {
  it('should validate and return valid DeliveryStatusPayload', () => {
    const payload = {
      orderId: '123e4567-e89b-12d3-a456-426614174000',
      orderNumber: 'ORD-12345',
      orderType: 'catering',
      driverId: '223e4567-e89b-12d3-a456-426614174001',
      status: 'EN_ROUTE_TO_CLIENT',
      timestamp: new Date().toISOString(),
    };

    const result = validatePayload(REALTIME_EVENTS.DELIVERY_STATUS_UPDATE, payload);
    expect(result).toEqual(payload);
  });

  it('should validate DeliveryStatusUpdatedPayload', () => {
    const payload = {
      orderId: '123e4567-e89b-12d3-a456-426614174000',
      orderNumber: 'ORD-12345',
      orderType: 'catering',
      driverId: '223e4567-e89b-12d3-a456-426614174001',
      status: 'COMPLETED',
      timestamp: new Date().toISOString(),
      driverName: 'John Doe',
    };

    const result = validatePayload(REALTIME_EVENTS.DELIVERY_STATUS_UPDATED, payload);
    expect(result).toHaveProperty('driverName', 'John Doe');
  });

  it('should throw PayloadValidationError for invalid payload', () => {
    const invalidPayload = {
      orderId: 'not-a-uuid',
      orderNumber: 'ORD-12345',
      orderType: 'catering',
      driverId: '223e4567-e89b-12d3-a456-426614174001',
      status: 'EN_ROUTE_TO_CLIENT',
      timestamp: new Date().toISOString(),
    };

    expect(() =>
      validatePayload(REALTIME_EVENTS.DELIVERY_STATUS_UPDATE, invalidPayload)
    ).toThrow(PayloadValidationError);
  });

  it('should allow any payload for unknown events (backwards compatibility)', () => {
    const customPayload = {
      customField: 'custom value',
      anotherField: 123,
    };

    const result = validatePayload('unknown:event', customPayload);
    expect(result).toEqual(customPayload);
  });
});

describe('Input sanitization', () => {
  it('should sanitize orderNumber to prevent XSS', () => {
    const payload = {
      orderId: '123e4567-e89b-12d3-a456-426614174000',
      orderNumber: '<script>alert("xss")</script>ORD-123',
      orderType: 'catering',
      driverId: '223e4567-e89b-12d3-a456-426614174001',
      status: 'EN_ROUTE_TO_CLIENT',
      timestamp: new Date().toISOString(),
    };

    const result = DeliveryStatusPayloadSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      // InputSanitizer should have removed script tags
      expect(result.data.orderNumber).not.toContain('<script>');
      expect(result.data.orderNumber).not.toContain('</script>');
    }
  });

  it('should sanitize driverName to prevent XSS', () => {
    const payload = {
      orderId: '123e4567-e89b-12d3-a456-426614174000',
      orderNumber: 'ORD-12345',
      orderType: 'catering',
      driverId: '223e4567-e89b-12d3-a456-426614174001',
      status: 'EN_ROUTE_TO_CLIENT',
      timestamp: new Date().toISOString(),
      driverName: '<img onerror="alert(1)" src="x">John',
    };

    const result = DeliveryStatusUpdatedPayloadSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      // Should sanitize HTML tags
      expect(result.data.driverName).not.toContain('<img');
      expect(result.data.driverName).not.toContain('onerror');
    }
  });

  it('should trim whitespace from string fields', () => {
    const payload = {
      orderId: '123e4567-e89b-12d3-a456-426614174000',
      orderNumber: '  ORD-12345  ',
      orderType: 'catering',
      driverId: '223e4567-e89b-12d3-a456-426614174001',
      status: 'EN_ROUTE_TO_CLIENT',
      timestamp: new Date().toISOString(),
    };

    const result = DeliveryStatusPayloadSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.orderNumber).toBe('ORD-12345');
    }
  });
});

describe('String length limits', () => {
  it('should reject orderNumber exceeding max length', () => {
    const payload = {
      orderId: '123e4567-e89b-12d3-a456-426614174000',
      orderNumber: 'X'.repeat(1001), // Exceeds MAX_STRING_LENGTH
      orderType: 'catering',
      driverId: '223e4567-e89b-12d3-a456-426614174001',
      status: 'EN_ROUTE_TO_CLIENT',
      timestamp: new Date().toISOString(),
    };

    const result = DeliveryStatusPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject driverName exceeding max length', () => {
    const payload = {
      orderId: '123e4567-e89b-12d3-a456-426614174000',
      orderNumber: 'ORD-12345',
      orderType: 'catering',
      driverId: '223e4567-e89b-12d3-a456-426614174001',
      status: 'EN_ROUTE_TO_CLIENT',
      timestamp: new Date().toISOString(),
      driverName: 'A'.repeat(1001),
    };

    const result = DeliveryStatusUpdatedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
