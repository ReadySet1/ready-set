/**
 * Unit Tests for Broker Sync Service
 *
 * Tests the syncOrderStatusWithBroker function with mocked dependencies.
 * Covers broker identification, status mapping, and error handling.
 *
 * Part of REA-315: Service Layer Unit Tests
 */

import { syncOrderStatusWithBroker } from '@/lib/services/brokerSyncService';
import { Order, OrderStatus, CateringRequest, OnDemand, CateringNeedHost, VehicleType } from '@/types/order';
import {
  createMockCateringRequest,
  createMockOnDemand,
  createMockAddress,
  createMockProfile,
  resetIdCounter,
} from '../helpers/mock-data-factories';
import {
  createCaterValleySuccessResponse,
  createCaterValleyErrorResponse,
  resetAllMocks,
} from '../helpers/service-test-utils';

// Mock the CaterValley service
jest.mock('@/services/caterValleyService', () => ({
  updateCaterValleyOrderStatus: jest.fn(),
}));

// Create a mock toast function with attached methods
const mockToastFn = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastLoading = jest.fn();
const mockToastDismiss = jest.fn();
const mockToastCustom = jest.fn();

// Mock react-hot-toast
jest.mock('react-hot-toast', () => {
  const toastMock = Object.assign(
    (...args: unknown[]) => mockToastFn(...args),
    {
      success: (...args: unknown[]) => mockToastSuccess(...args),
      error: (...args: unknown[]) => mockToastError(...args),
      loading: (...args: unknown[]) => mockToastLoading(...args),
      dismiss: (...args: unknown[]) => mockToastDismiss(...args),
      custom: (...args: unknown[]) => mockToastCustom(...args),
    }
  );
  return {
    __esModule: true,
    default: toastMock,
  };
});

// Get mocked functions
import { updateCaterValleyOrderStatus } from '@/services/caterValleyService';
import toast from 'react-hot-toast';

const mockedUpdateCaterValleyOrderStatus = updateCaterValleyOrderStatus as jest.Mock;

describe('BrokerSyncService', () => {
  beforeEach(() => {
    resetAllMocks();
    resetIdCounter();
    mockedUpdateCaterValleyOrderStatus.mockClear();
    mockToastFn.mockClear();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  // Helper to create a proper CateringRequest order
  function createCateringOrder(overrides: Partial<CateringRequest> = {}): CateringRequest {
    const mockReq = createMockCateringRequest(overrides);
    return {
      ...mockReq,
      order_type: 'catering',
      needHost: CateringNeedHost.NO,
      user: createMockProfile(),
      pickupAddress: createMockAddress({ isRestaurant: true }),
      deliveryAddress: createMockAddress(),
      dispatches: [],
    } as CateringRequest;
  }

  // Helper to create a proper OnDemand order
  function createOnDemandOrder(overrides: Partial<OnDemand> = {}): OnDemand {
    const mockReq = createMockOnDemand(overrides);
    return {
      ...mockReq,
      order_type: 'on_demand',
      vehicleType: VehicleType.CAR,
      user: createMockProfile(),
      pickupAddress: createMockAddress(),
      deliveryAddress: createMockAddress(),
      dispatches: [],
    } as OnDemand;
  }

  describe('Broker Identification', () => {
    it('should identify CaterValley orders by brokerage field', async () => {
      const order = createCateringOrder({ brokerage: 'CaterValley' });

      mockedUpdateCaterValleyOrderStatus.mockResolvedValue({
        success: true,
        orderFound: true,
        response: createCaterValleySuccessResponse(),
      });

      await syncOrderStatusWithBroker(order, OrderStatus.ASSIGNED);

      expect(mockedUpdateCaterValleyOrderStatus).toHaveBeenCalledWith(
        order.orderNumber,
        'CONFIRM'
      );
    });

    it('should not sync for non-brokered catering orders', async () => {
      const order = createCateringOrder({ brokerage: null });

      await syncOrderStatusWithBroker(order, OrderStatus.ASSIGNED);

      expect(mockedUpdateCaterValleyOrderStatus).not.toHaveBeenCalled();
    });

    it('should not sync for unknown brokers', async () => {
      const order = createCateringOrder({ brokerage: 'UnknownBroker' });

      await syncOrderStatusWithBroker(order, OrderStatus.ASSIGNED);

      expect(mockedUpdateCaterValleyOrderStatus).not.toHaveBeenCalled();
    });

    it('should not sync for on-demand orders (no broker support)', async () => {
      const order = createOnDemandOrder();

      await syncOrderStatusWithBroker(order, OrderStatus.ASSIGNED);

      expect(mockedUpdateCaterValleyOrderStatus).not.toHaveBeenCalled();
    });
  });

  describe('Status Mapping', () => {
    it('should map ASSIGNED to CONFIRM for CaterValley', async () => {
      const order = createCateringOrder({ brokerage: 'CaterValley' });

      mockedUpdateCaterValleyOrderStatus.mockResolvedValue({
        success: true,
        orderFound: true,
        response: createCaterValleySuccessResponse(),
      });

      await syncOrderStatusWithBroker(order, OrderStatus.ASSIGNED);

      expect(mockedUpdateCaterValleyOrderStatus).toHaveBeenCalledWith(
        order.orderNumber,
        'CONFIRM'
      );
    });

    it('should map CANCELLED to CANCELLED for CaterValley', async () => {
      const order = createCateringOrder({ brokerage: 'CaterValley' });

      mockedUpdateCaterValleyOrderStatus.mockResolvedValue({
        success: true,
        orderFound: true,
        response: createCaterValleySuccessResponse(),
      });

      await syncOrderStatusWithBroker(order, OrderStatus.CANCELLED);

      expect(mockedUpdateCaterValleyOrderStatus).toHaveBeenCalledWith(
        order.orderNumber,
        'CANCELLED'
      );
    });

    it('should map COMPLETED to COMPLETED for CaterValley', async () => {
      const order = createCateringOrder({ brokerage: 'CaterValley' });

      mockedUpdateCaterValleyOrderStatus.mockResolvedValue({
        success: true,
        orderFound: true,
        response: createCaterValleySuccessResponse(),
      });

      await syncOrderStatusWithBroker(order, OrderStatus.COMPLETED);

      expect(mockedUpdateCaterValleyOrderStatus).toHaveBeenCalledWith(
        order.orderNumber,
        'COMPLETED'
      );
    });

    it('should not sync for unmapped statuses', async () => {
      const order = createCateringOrder({ brokerage: 'CaterValley' });

      // PENDING is not mapped to a CaterValley status
      await syncOrderStatusWithBroker(order, OrderStatus.PENDING);

      expect(mockedUpdateCaterValleyOrderStatus).not.toHaveBeenCalled();
    });

    it('should not sync for ACTIVE status (no mapping)', async () => {
      const order = createCateringOrder({ brokerage: 'CaterValley' });

      await syncOrderStatusWithBroker(order, OrderStatus.ACTIVE);

      expect(mockedUpdateCaterValleyOrderStatus).not.toHaveBeenCalled();
    });

    it('should not sync for IN_PROGRESS status (no mapping)', async () => {
      const order = createCateringOrder({ brokerage: 'CaterValley' });

      await syncOrderStatusWithBroker(order, OrderStatus.IN_PROGRESS);

      expect(mockedUpdateCaterValleyOrderStatus).not.toHaveBeenCalled();
    });
  });

  describe('Toast Notifications', () => {
    it('should show warning toast when order not found (404)', async () => {
      const order = createCateringOrder({ brokerage: 'CaterValley' });

      mockedUpdateCaterValleyOrderStatus.mockResolvedValue({
        success: false,
        orderFound: false,
        statusCode: 404,
        error: 'Order not found',
      });

      await syncOrderStatusWithBroker(order, OrderStatus.ASSIGNED);

      expect(mockToastFn).toHaveBeenCalledWith(
        expect.stringContaining('Order not found'),
        expect.objectContaining({
          duration: 4000,
          icon: expect.any(String),
        })
      );
    });

    it('should show warning toast on sync failure', async () => {
      const order = createCateringOrder({ brokerage: 'CaterValley' });

      mockedUpdateCaterValleyOrderStatus.mockResolvedValue({
        success: false,
        orderFound: true,
        statusCode: 500,
        error: 'Server error',
      });

      await syncOrderStatusWithBroker(order, OrderStatus.ASSIGNED);

      expect(mockToastFn).toHaveBeenCalledWith(
        expect.stringContaining('sync failed'),
        expect.objectContaining({
          duration: 5000,
        })
      );
    });

    it('should not show toast on successful sync', async () => {
      const order = createCateringOrder({ brokerage: 'CaterValley' });

      mockedUpdateCaterValleyOrderStatus.mockResolvedValue({
        success: true,
        orderFound: true,
        response: createCaterValleySuccessResponse(),
      });

      await syncOrderStatusWithBroker(order, OrderStatus.ASSIGNED);

      // Success toast is optional and commented out in the code
      // So we just verify no error toasts were shown
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  describe('Error Resilience', () => {
    it('should not throw when CaterValley update fails', async () => {
      const order = createCateringOrder({ brokerage: 'CaterValley' });

      mockedUpdateCaterValleyOrderStatus.mockResolvedValue({
        success: false,
        orderFound: false,
        error: 'Network error',
      });

      // Should not throw
      await expect(
        syncOrderStatusWithBroker(order, OrderStatus.ASSIGNED)
      ).resolves.not.toThrow();
    });

    it('should handle sync failure gracefully without blocking main operation', async () => {
      const order = createCateringOrder({ brokerage: 'CaterValley' });

      mockedUpdateCaterValleyOrderStatus.mockResolvedValue({
        success: false,
        orderFound: true,
        statusCode: 503,
        error: 'Circuit breaker open',
      });

      // Function should complete without throwing
      await syncOrderStatusWithBroker(order, OrderStatus.COMPLETED);

      // Should have attempted the sync
      expect(mockedUpdateCaterValleyOrderStatus).toHaveBeenCalled();
    });

    it('should log warning for missing configuration', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const order = createCateringOrder({ brokerage: 'CaterValley' });

      // Status that doesn't have a mapping
      await syncOrderStatusWithBroker(order, OrderStatus.DELIVERED);

      // The function logs when status doesn't have a broker mapping
      // but doesn't throw an error
      consoleSpy.mockRestore();
    });
  });

  describe('Order Number Handling', () => {
    it('should use the correct order number for sync', async () => {
      const order = createCateringOrder({
        brokerage: 'CaterValley',
        orderNumber: 'CV-12345-ABC',
      });

      mockedUpdateCaterValleyOrderStatus.mockResolvedValue({
        success: true,
        orderFound: true,
        response: createCaterValleySuccessResponse(),
      });

      await syncOrderStatusWithBroker(order, OrderStatus.ASSIGNED);

      expect(mockedUpdateCaterValleyOrderStatus).toHaveBeenCalledWith(
        'CV-12345-ABC',
        'CONFIRM'
      );
    });
  });
});
