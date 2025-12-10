/**
 * Unit tests for CourierEventService
 */

import { CourierEventService, courierEventService } from '../courier-event.service';
import { courierEventCreate, courierAssign } from '@/lib/ezcater/operations';
import type { DriverStatus } from '@/types/prisma';

// Mock the operations module
jest.mock('@/lib/ezcater/operations', () => ({
  courierEventCreate: jest.fn(),
  courierAssign: jest.fn(),
}));

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockCourierEventCreate = courierEventCreate as jest.MockedFunction<typeof courierEventCreate>;
const mockCourierAssign = courierAssign as jest.MockedFunction<typeof courierAssign>;

describe('CourierEventService', () => {
  const mockDriver = {
    id: 'driver-123',
    firstName: 'John',
    lastName: 'Doe',
    phone: '555-1234',
  };

  const mockCoordinates = {
    latitude: 37.7749,
    longitude: -122.4194,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = CourierEventService.getInstance();
      const instance2 = CourierEventService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should be the same as the exported courierEventService', () => {
      expect(courierEventService).toBe(CourierEventService.getInstance());
    });
  });

  describe('mapStatusToEventType', () => {
    it('should map ASSIGNED to COURIER_ASSIGNED', () => {
      expect(CourierEventService.mapStatusToEventType('ASSIGNED')).toBe('COURIER_ASSIGNED');
    });

    it('should map ARRIVED_AT_VENDOR to ARRIVED_AT_PICKUP', () => {
      expect(CourierEventService.mapStatusToEventType('ARRIVED_AT_VENDOR')).toBe('ARRIVED_AT_PICKUP');
    });

    it('should map PICKED_UP to ORDER_PICKED_UP', () => {
      expect(CourierEventService.mapStatusToEventType('PICKED_UP')).toBe('ORDER_PICKED_UP');
    });

    it('should map EN_ROUTE_TO_CLIENT to EN_ROUTE_TO_DROPOFF', () => {
      expect(CourierEventService.mapStatusToEventType('EN_ROUTE_TO_CLIENT')).toBe('EN_ROUTE_TO_DROPOFF');
    });

    it('should map ARRIVED_TO_CLIENT to ARRIVED_AT_DROPOFF', () => {
      expect(CourierEventService.mapStatusToEventType('ARRIVED_TO_CLIENT')).toBe('ARRIVED_AT_DROPOFF');
    });

    it('should map COMPLETED to ORDER_DELIVERED', () => {
      expect(CourierEventService.mapStatusToEventType('COMPLETED')).toBe('ORDER_DELIVERED');
    });
  });

  describe('hasEventMapping', () => {
    it('should return true for statuses with mappings', () => {
      const statusesWithMappings: DriverStatus[] = [
        'ASSIGNED',
        'ARRIVED_AT_VENDOR',
        'PICKED_UP',
        'EN_ROUTE_TO_CLIENT',
        'ARRIVED_TO_CLIENT',
        'COMPLETED',
      ];

      statusesWithMappings.forEach((status) => {
        expect(CourierEventService.hasEventMapping(status)).toBe(true);
      });
    });
  });

  describe('buildCourierInfo', () => {
    it('should build courier info from driver data', () => {
      const result = CourierEventService.buildCourierInfo(mockDriver);

      expect(result).toEqual({
        id: 'driver-123',
        firstName: 'John',
        lastName: 'Doe',
        phone: '555-1234',
        vehicle: undefined,
      });
    });

    it('should include vehicle info when provided', () => {
      const driverWithVehicle = {
        ...mockDriver,
        vehicle: {
          make: 'Toyota',
          model: 'Camry',
          color: 'Blue',
        },
      };

      const result = CourierEventService.buildCourierInfo(driverWithVehicle);

      expect(result.vehicle).toEqual({
        make: 'Toyota',
        model: 'Camry',
        color: 'Blue',
      });
    });

    it('should handle missing optional fields', () => {
      const minimalDriver = { id: 'driver-456' };
      const result = CourierEventService.buildCourierInfo(minimalDriver);

      expect(result).toEqual({
        id: 'driver-456',
        firstName: undefined,
        lastName: undefined,
        phone: undefined,
        vehicle: undefined,
      });
    });
  });

  describe('isEzCaterOrder', () => {
    it('should return true for orders starting with EZ-', () => {
      expect(CourierEventService.isEzCaterOrder('EZ-12345')).toBe(true);
      expect(CourierEventService.isEzCaterOrder('EZ-ABC')).toBe(true);
    });

    it('should return false for orders not starting with EZ-', () => {
      expect(CourierEventService.isEzCaterOrder('CV-12345')).toBe(false);
      expect(CourierEventService.isEzCaterOrder('12345')).toBe(false);
      expect(CourierEventService.isEzCaterOrder('ez-12345')).toBe(false); // case sensitive
    });
  });

  describe('reportEvent', () => {
    it('should call courierEventCreate with correct parameters', async () => {
      mockCourierEventCreate.mockResolvedValueOnce({ success: true });

      const result = await courierEventService.reportEvent({
        deliveryId: 'delivery-123',
        eventType: 'ORDER_PICKED_UP',
        driver: mockDriver,
        coordinates: mockCoordinates,
      });

      expect(mockCourierEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryId: 'delivery-123',
          eventType: 'ORDER_PICKED_UP',
          courier: expect.objectContaining({
            id: 'driver-123',
            firstName: 'John',
            lastName: 'Doe',
          }),
          coordinates: mockCoordinates,
        })
      );

      expect(result.success).toBe(true);
      expect(result.deliveryId).toBe('delivery-123');
      expect(result.eventType).toBe('ORDER_PICKED_UP');
    });

    it('should return error result when operation fails', async () => {
      mockCourierEventCreate.mockRejectedValueOnce(new Error('API Error'));

      const result = await courierEventService.reportEvent({
        deliveryId: 'delivery-123',
        eventType: 'ORDER_PICKED_UP',
        driver: mockDriver,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });

  describe('assignCourier', () => {
    it('should call courierAssign with correct parameters', async () => {
      mockCourierAssign.mockResolvedValueOnce({ success: true });

      const result = await courierEventService.assignCourier('delivery-123', mockDriver);

      expect(mockCourierAssign).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryId: 'delivery-123',
          courier: expect.objectContaining({
            id: 'driver-123',
          }),
          deliveryServiceProvider: 'Ready Set',
        })
      );

      expect(result.success).toBe(true);
      expect(result.eventType).toBe('COURIER_ASSIGNED');
    });

    it('should return error result when assignment fails', async () => {
      mockCourierAssign.mockRejectedValueOnce(new Error('Assignment failed'));

      const result = await courierEventService.assignCourier('delivery-123', mockDriver);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Assignment failed');
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      mockCourierEventCreate.mockResolvedValue({ success: true });
    });

    it('markEnRouteToPickup should report EN_ROUTE_TO_PICKUP event', async () => {
      await courierEventService.markEnRouteToPickup('delivery-123', mockDriver, mockCoordinates);

      expect(mockCourierEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'EN_ROUTE_TO_PICKUP',
        })
      );
    });

    it('markArrivedAtPickup should report ARRIVED_AT_PICKUP event', async () => {
      await courierEventService.markArrivedAtPickup('delivery-123', mockDriver);

      expect(mockCourierEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ARRIVED_AT_PICKUP',
        })
      );
    });

    it('markPickedUp should report ORDER_PICKED_UP event', async () => {
      await courierEventService.markPickedUp('delivery-123', mockDriver);

      expect(mockCourierEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ORDER_PICKED_UP',
        })
      );
    });

    it('markEnRouteToDropoff should report EN_ROUTE_TO_DROPOFF event', async () => {
      await courierEventService.markEnRouteToDropoff('delivery-123', mockDriver);

      expect(mockCourierEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'EN_ROUTE_TO_DROPOFF',
        })
      );
    });

    it('markArrivedAtDropoff should report ARRIVED_AT_DROPOFF event', async () => {
      await courierEventService.markArrivedAtDropoff('delivery-123', mockDriver);

      expect(mockCourierEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ARRIVED_AT_DROPOFF',
        })
      );
    });

    it('markDelivered should report ORDER_DELIVERED event', async () => {
      await courierEventService.markDelivered('delivery-123', mockDriver);

      expect(mockCourierEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ORDER_DELIVERED',
        })
      );
    });
  });

  describe('reportStatusChange', () => {
    beforeEach(() => {
      mockCourierEventCreate.mockResolvedValue({ success: true });
      mockCourierAssign.mockResolvedValue({ success: true });
    });

    it('should use assignCourier for ASSIGNED status', async () => {
      await courierEventService.reportStatusChange(
        'delivery-123',
        'ASSIGNED',
        mockDriver
      );

      expect(mockCourierAssign).toHaveBeenCalled();
      expect(mockCourierEventCreate).not.toHaveBeenCalled();
    });

    it('should use reportEvent for other statuses', async () => {
      await courierEventService.reportStatusChange(
        'delivery-123',
        'PICKED_UP',
        mockDriver
      );

      expect(mockCourierEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ORDER_PICKED_UP',
        })
      );
    });

    it('should include coordinates when provided', async () => {
      await courierEventService.reportStatusChange(
        'delivery-123',
        'ARRIVED_AT_VENDOR',
        mockDriver,
        mockCoordinates
      );

      expect(mockCourierEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          coordinates: mockCoordinates,
        })
      );
    });
  });
});
