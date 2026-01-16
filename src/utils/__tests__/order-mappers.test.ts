import {
  mapPrismaCateringRequestToAppType,
  mapPrismaOnDemandToAppType,
  mergeOrderResults,
} from '../order-mappers';
import { OrderStatus, DriverStatus, CateringNeedHost, VehicleType } from '../../types/order';

// Mock data for testing
const mockAddress = {
  id: 'addr-123',
  name: 'Test Address',
  street1: '123 Main St',
  street2: 'Suite 100',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  county: 'Travis',
  locationNumber: '101',
  parkingLoading: 'Front door',
  isRestaurant: true,
  isShared: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  createdBy: 'user-123',
};

const mockUser = {
  id: 'user-123',
  name: 'John Doe',
  email: 'john@example.com',
  contactNumber: '555-1234',
  guid: 'user-guid',
  type: 'client',
  isActive: true,
  isTemporaryPassword: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
};

const mockDriver = {
  id: 'driver-123',
  name: 'Jane Driver',
  email: 'jane@example.com',
  contactNumber: '555-5678',
};

const mockDispatch = {
  id: 'dispatch-123',
  cateringRequestId: 'catering-123',
  onDemandId: null,
  driverId: 'driver-123',
  userId: 'user-123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  driver: mockDriver,
};

const mockFileUpload = {
  id: 'file-123',
  fileName: 'receipt.pdf',
  fileType: 'application/pdf',
  fileSize: 1024,
  fileUrl: 'https://storage.example.com/receipt.pdf',
  category: 'receipt',
  uploadedAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  userId: 'user-123',
  cateringRequestId: 'catering-123',
  onDemandId: null,
  isTemporary: false,
};

// Helper to create a mock Decimal that works with Number() conversion
function createMockDecimal(value: number) {
  return {
    toNumber: () => value,
    valueOf: () => value,
    toString: () => String(value),
  };
}

const basePrismaCateringRequest = {
  id: 'catering-123',
  guid: 'catering-guid-123',
  userId: 'user-123',
  pickupAddressId: 'addr-pickup',
  deliveryAddressId: 'addr-delivery',
  orderNumber: 'CAT-001',
  pickupDateTime: new Date('2024-01-15T10:00:00'),
  arrivalDateTime: new Date('2024-01-15T11:00:00'),
  completeDateTime: new Date('2024-01-15T11:30:00'),
  clientAttention: 'Call on arrival',
  pickupNotes: 'Use side entrance',
  specialNotes: 'Handle with care',
  image: 'https://storage.example.com/image.jpg',
  status: 'ACTIVE',
  orderTotal: createMockDecimal(250.50),
  tip: createMockDecimal(25.00),
  driverStatus: 'assigned',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  user: mockUser,
  pickupAddress: { ...mockAddress, id: 'addr-pickup' },
  deliveryAddress: { ...mockAddress, id: 'addr-delivery' },
  dispatches: [mockDispatch],
  fileUploads: [mockFileUpload],
  // Catering-specific fields
  brokerage: 'Test Brokerage',
  headcount: 50,
  needHost: 'YES',
  hoursNeeded: 2,
  numberOfHosts: 1,
};

const basePrismaOnDemand = {
  id: 'ondemand-123',
  guid: 'ondemand-guid-123',
  userId: 'user-123',
  pickupAddressId: 'addr-pickup',
  deliveryAddressId: 'addr-delivery',
  orderNumber: 'OND-001',
  pickupDateTime: new Date('2024-01-15T14:00:00'),
  arrivalDateTime: new Date('2024-01-15T15:00:00'),
  completeDateTime: new Date('2024-01-15T15:30:00'),
  clientAttention: 'Office manager',
  pickupNotes: 'Loading dock',
  specialNotes: 'Fragile items',
  image: 'https://storage.example.com/image2.jpg',
  status: 'ACTIVE',
  orderTotal: createMockDecimal(75.00),
  tip: createMockDecimal(10.00),
  driverStatus: 'pending',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  user: mockUser,
  pickupAddress: { ...mockAddress, id: 'addr-pickup' },
  deliveryAddress: { ...mockAddress, id: 'addr-delivery' },
  dispatches: [{ ...mockDispatch, onDemandId: 'ondemand-123', cateringRequestId: null }],
  fileUploads: [{ ...mockFileUpload, onDemandId: 'ondemand-123', cateringRequestId: null }],
  // On-demand specific fields
  itemDelivered: 'Electronics',
  vehicleType: 'CAR',
  hoursNeeded: 1,
  length: 24,
  width: 18,
  height: 12,
  weight: 50,
};

describe('order-mappers', () => {
  describe('mapPrismaCateringRequestToAppType', () => {
    it('should map basic catering request fields', () => {
      const result = mapPrismaCateringRequestToAppType(basePrismaCateringRequest as any);

      expect(result.id).toBe('catering-123');
      expect(result.guid).toBe('catering-guid-123');
      expect(result.userId).toBe('user-123');
      expect(result.orderNumber).toBe('CAT-001');
      expect(result.order_type).toBe('catering');
    });

    it('should map user information', () => {
      const result = mapPrismaCateringRequestToAppType(basePrismaCateringRequest as any);

      expect(result.user).toEqual({
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
      });
    });

    it('should map pickup address', () => {
      const result = mapPrismaCateringRequestToAppType(basePrismaCateringRequest as any);

      expect(result.pickupAddress.id).toBe('addr-pickup');
      expect(result.pickupAddress.street1).toBe('123 Main St');
      expect(result.pickupAddress.city).toBe('Austin');
      expect(result.pickupAddress.state).toBe('TX');
    });

    it('should map delivery address', () => {
      const result = mapPrismaCateringRequestToAppType(basePrismaCateringRequest as any);

      expect(result.deliveryAddress.id).toBe('addr-delivery');
      expect(result.deliveryAddress.street1).toBe('123 Main St');
    });

    it('should convert Decimal to number for orderTotal and tip', () => {
      const result = mapPrismaCateringRequestToAppType(basePrismaCateringRequest as any);

      expect(result.orderTotal).toBe(250.50);
      expect(result.tip).toBe(25.00);
    });

    it('should handle null orderTotal and tip', () => {
      const requestWithNullTotals = {
        ...basePrismaCateringRequest,
        orderTotal: null,
        tip: null,
      };

      const result = mapPrismaCateringRequestToAppType(requestWithNullTotals as any);

      expect(result.orderTotal).toBeNull();
      expect(result.tip).toBeNull();
    });

    it('should map dispatches with driver information', () => {
      const result = mapPrismaCateringRequestToAppType(basePrismaCateringRequest as any);

      expect(result.dispatches).toHaveLength(1);
      expect(result.dispatches[0].id).toBe('dispatch-123');
      expect(result.dispatches[0].driver).toEqual({
        id: 'driver-123',
        name: 'Jane Driver',
        email: 'jane@example.com',
        contactNumber: '555-5678',
      });
    });

    it('should handle dispatch without driver', () => {
      const requestWithoutDriver = {
        ...basePrismaCateringRequest,
        dispatches: [{ ...mockDispatch, driver: null }],
      };

      const result = mapPrismaCateringRequestToAppType(requestWithoutDriver as any);

      expect(result.dispatches[0].driver).toBeUndefined();
    });

    it('should map file uploads', () => {
      const result = mapPrismaCateringRequestToAppType(basePrismaCateringRequest as any);

      expect(result.fileUploads).toHaveLength(1);
      expect(result.fileUploads[0].id).toBe('file-123');
      expect(result.fileUploads[0].fileName).toBe('receipt.pdf');
      expect(result.fileUploads[0].entityType).toBe('catering');
    });

    it('should map catering-specific fields', () => {
      const result = mapPrismaCateringRequestToAppType(basePrismaCateringRequest as any);

      expect(result.brokerage).toBe('Test Brokerage');
      expect(result.headcount).toBe(50);
      expect(result.needHost).toBe(CateringNeedHost.YES);
      expect(result.hoursNeeded).toBe(2);
      expect(result.numberOfHosts).toBe(1);
    });

    it('should default needHost to NO when not provided', () => {
      const requestWithoutNeedHost = {
        ...basePrismaCateringRequest,
        needHost: null,
      };

      const result = mapPrismaCateringRequestToAppType(requestWithoutNeedHost as any);

      expect(result.needHost).toBe(CateringNeedHost.NO);
    });

    it('should default status to ACTIVE when not provided', () => {
      const requestWithoutStatus = {
        ...basePrismaCateringRequest,
        status: null,
      };

      const result = mapPrismaCateringRequestToAppType(requestWithoutStatus as any);

      expect(result.status).toBe(OrderStatus.ACTIVE);
    });

    it('should map date fields correctly', () => {
      const result = mapPrismaCateringRequestToAppType(basePrismaCateringRequest as any);

      expect(result.pickupDateTime).toEqual(new Date('2024-01-15T10:00:00'));
      expect(result.arrivalDateTime).toEqual(new Date('2024-01-15T11:00:00'));
      expect(result.completeDateTime).toEqual(new Date('2024-01-15T11:30:00'));
      expect(result.createdAt).toEqual(new Date('2024-01-01'));
      expect(result.updatedAt).toEqual(new Date('2024-01-02'));
    });

    it('should default pickupDateTime when null', () => {
      const requestWithNullPickup = {
        ...basePrismaCateringRequest,
        pickupDateTime: null,
      };

      const result = mapPrismaCateringRequestToAppType(requestWithNullPickup as any);

      expect(result.pickupDateTime).toBeInstanceOf(Date);
    });
  });

  describe('mapPrismaOnDemandToAppType', () => {
    it('should map basic on-demand fields', () => {
      const result = mapPrismaOnDemandToAppType(basePrismaOnDemand as any);

      expect(result.id).toBe('ondemand-123');
      expect(result.guid).toBe('ondemand-guid-123');
      expect(result.orderNumber).toBe('OND-001');
      expect(result.order_type).toBe('on_demand');
    });

    it('should map on-demand specific fields', () => {
      const result = mapPrismaOnDemandToAppType(basePrismaOnDemand as any);

      expect(result.itemDelivered).toBe('Electronics');
      expect(result.vehicleType).toBe(VehicleType.CAR);
      expect(result.length).toBe(24);
      expect(result.width).toBe(18);
      expect(result.height).toBe(12);
      expect(result.weight).toBe(50);
    });

    it('should map user information', () => {
      const result = mapPrismaOnDemandToAppType(basePrismaOnDemand as any);

      expect(result.user).toEqual({
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
      });
    });

    it('should map addresses', () => {
      const result = mapPrismaOnDemandToAppType(basePrismaOnDemand as any);

      expect(result.pickupAddress.id).toBe('addr-pickup');
      expect(result.deliveryAddress.id).toBe('addr-delivery');
    });

    it('should convert Decimal values', () => {
      const result = mapPrismaOnDemandToAppType(basePrismaOnDemand as any);

      expect(result.orderTotal).toBe(75.00);
      expect(result.tip).toBe(10.00);
    });

    it('should map file uploads with on_demand entityType', () => {
      const result = mapPrismaOnDemandToAppType(basePrismaOnDemand as any);

      expect(result.fileUploads[0].entityType).toBe('on_demand');
    });

    it('should default status to ACTIVE when not provided', () => {
      const requestWithoutStatus = {
        ...basePrismaOnDemand,
        status: null,
      };

      const result = mapPrismaOnDemandToAppType(requestWithoutStatus as any);

      expect(result.status).toBe(OrderStatus.ACTIVE);
    });
  });

  describe('mergeOrderResults', () => {
    it('should merge catering and on-demand orders', () => {
      const cateringRequests = [basePrismaCateringRequest as any];
      const onDemands = [basePrismaOnDemand as any];

      const result = mergeOrderResults(cateringRequests, onDemands);

      expect(result).toHaveLength(2);
      expect(result[0].order_type).toBe('catering');
      expect(result[1].order_type).toBe('on_demand');
    });

    it('should handle empty arrays', () => {
      const result = mergeOrderResults([], []);
      expect(result).toHaveLength(0);
    });

    it('should handle only catering orders', () => {
      const cateringRequests = [basePrismaCateringRequest as any];

      const result = mergeOrderResults(cateringRequests, []);

      expect(result).toHaveLength(1);
      expect(result[0].order_type).toBe('catering');
    });

    it('should handle only on-demand orders', () => {
      const onDemands = [basePrismaOnDemand as any];

      const result = mergeOrderResults([], onDemands);

      expect(result).toHaveLength(1);
      expect(result[0].order_type).toBe('on_demand');
    });

    it('should handle multiple orders of each type', () => {
      const cateringRequests = [
        { ...basePrismaCateringRequest, id: 'cat-1' } as any,
        { ...basePrismaCateringRequest, id: 'cat-2' } as any,
      ];
      const onDemands = [
        { ...basePrismaOnDemand, id: 'od-1' } as any,
        { ...basePrismaOnDemand, id: 'od-2' } as any,
        { ...basePrismaOnDemand, id: 'od-3' } as any,
      ];

      const result = mergeOrderResults(cateringRequests, onDemands);

      expect(result).toHaveLength(5);
      expect(result.filter(o => o.order_type === 'catering')).toHaveLength(2);
      expect(result.filter(o => o.order_type === 'on_demand')).toHaveLength(3);
    });
  });
});
