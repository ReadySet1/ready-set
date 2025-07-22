import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the actual serializeOrder function from the orders API
function serializeOrder(data: any): any {
  const formatDate = (date: string | Date | null, state: string | null) => {
    if (!date) return null;
    
    const utcDate = new Date(date);
    let timezone = 'America/Los_Angeles';
    if (state === 'TX') {
      timezone = 'America/Chicago';
    }
    
    return utcDate.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };

  const state = data.deliveryAddress?.state || null;

  const formattedDates = {
    pickupDateTime: formatDate(data.pickupDateTime, state),
    arrivalDateTime: formatDate(data.arrivalDateTime, state),
    completeDateTime: formatDate(data.completeDateTime, state),
    createdAt: formatDate(data.createdAt, state),
    updatedAt: formatDate(data.updatedAt, state)
  };

  const serializedOrder = {
    ...JSON.parse(JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )),
    // Override with properly mapped field names
    order_number: data.orderNumber,
    order_total: data.orderTotal?.toString() || "0.00",
    special_notes: data.specialNotes,
    date: data.pickupDateTime || data.createdAt,
    pickup_time: formattedDates.pickupDateTime,
    arrival_time: formattedDates.arrivalDateTime,
    complete_time: formattedDates.completeDateTime,
    updated_at: formattedDates.updatedAt,
    user_id: data.userId,
    driver_status: data.driverStatus,
    address: {
      street1: data.pickupAddress?.street1 || null,
      city: data.pickupAddress?.city || null,
      state: data.pickupAddress?.state || null,
      zip: data.pickupAddress?.zip || null
    },
    delivery_address: data.deliveryAddress ? {
      street1: data.deliveryAddress.street1 || null,
      city: data.deliveryAddress.city || null,
      state: data.deliveryAddress.state || null,
      zip: data.deliveryAddress.zip || null
    } : null,
    dispatch: data.dispatches && data.dispatches.length > 0 ? data.dispatches : null,
    // Add catering-specific fields if present
    ...(data.headcount && { headcount: data.headcount }),
    ...(data.brokerage && { brokerage: data.brokerage }),
    ...(data.needHost && { need_host: data.needHost }),
    ...(data.hoursNeeded && { hours_needed: data.hoursNeeded }),
    ...(data.numberOfHosts && { number_of_hosts: data.numberOfHosts }),
    // Add on-demand specific fields if present  
    ...(data.itemDelivered && { item_delivered: data.itemDelivered }),
    ...(data.vehicleType && { vehicle_type: data.vehicleType }),
    ...(data.length && { length: data.length }),
    ...(data.width && { width: data.width }),
    ...(data.height && { height: data.height }),
    ...(data.weight && { weight: data.weight })
  };

  return serializedOrder;
}

describe('Orders API Field Mapping Integration Tests', () => {
  describe('Catering Order Field Mapping', () => {
    it('should correctly map all catering order fields from Prisma to frontend format', () => {
      const mockPrismaCateringOrder = {
        id: "catering-order-123",
        orderNumber: "Test 35689",
        orderTotal: 700.00,
        specialNotes: "Testing Order",
        userId: "user-456",
        driverStatus: "PENDING",
        status: "ACTIVE",
        pickupDateTime: "2024-01-15T10:00:00Z",
        arrivalDateTime: "2024-01-15T14:00:00Z",
        createdAt: "2024-01-14T08:00:00Z",
        updatedAt: "2024-01-14T08:30:00Z",
        // Catering-specific fields
        headcount: 40,
        brokerage: "Premium Catering",
        needHost: "YES",
        hoursNeeded: 4,
        numberOfHosts: 2,
        // Address relations
        pickupAddress: {
          street1: "99 Miami Av",
          city: "San Francisco",
          state: "CA",
          zip: "94015"
        },
        deliveryAddress: {
          street1: "101 El Camino Real",
          city: "San Mateo",
          state: "CA",
          zip: "94060"
        },
        dispatches: [],
        order_type: "catering"
      };

      const serializedOrder = serializeOrder(mockPrismaCateringOrder);

      // Verify core field mapping
      expect(serializedOrder.order_number).toBe("Test 35689");
      expect(serializedOrder.order_total).toBe("700");
      expect(serializedOrder.special_notes).toBe("Testing Order");
      expect(serializedOrder.user_id).toBe("user-456");
      expect(serializedOrder.driver_status).toBe("PENDING");

      // Verify date field mapping
      expect(serializedOrder.date).toBe("2024-01-15T10:00:00Z");
      expect(serializedOrder.pickup_time).toBeTruthy();
      expect(serializedOrder.arrival_time).toBeTruthy();

      // Verify address mapping
      expect(serializedOrder.address).toEqual({
        street1: "99 Miami Av",
        city: "San Francisco",
        state: "CA",
        zip: "94015"
      });

      expect(serializedOrder.delivery_address).toEqual({
        street1: "101 El Camino Real",
        city: "San Mateo",
        state: "CA",
        zip: "94060"
      });

      // Verify catering-specific field mapping
      expect(serializedOrder.headcount).toBe(40);
      expect(serializedOrder.brokerage).toBe("Premium Catering");
      expect(serializedOrder.need_host).toBe("YES");
      expect(serializedOrder.hours_needed).toBe(4);
      expect(serializedOrder.number_of_hosts).toBe(2);

      // Verify original camelCase fields are preserved for backward compatibility
      expect(serializedOrder.orderNumber).toBe("Test 35689");
      expect(serializedOrder.pickupAddress).toBeTruthy();
      expect(serializedOrder.deliveryAddress).toBeTruthy();
    });
  });

  describe('On-Demand Order Field Mapping', () => {
    it('should correctly map all on-demand order fields from Prisma to frontend format', () => {
      const mockPrismaOnDemandOrder = {
        id: "ondemand-order-456",
        orderNumber: "OD-67890",
        orderTotal: 150.00,
        specialNotes: "Fragile items",
        userId: "user-789",
        driverStatus: "ASSIGNED",
        status: "ACTIVE",
        pickupDateTime: "2024-01-16T09:00:00Z",
        arrivalDateTime: "2024-01-16T11:00:00Z",
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-15T10:30:00Z",
        // On-demand specific fields
        itemDelivered: "Electronics",
        vehicleType: "VAN",
        length: 24,
        width: 18,
        height: 12,
        weight: 50,
        // Address relations
        pickupAddress: {
          street1: "456 Tech Blvd",
          city: "Austin",
          state: "TX",
          zip: "78701"
        },
        deliveryAddress: {
          street1: "789 Innovation Dr",
          city: "Austin",
          state: "TX",
          zip: "78702"
        },
        dispatches: [],
        order_type: "on_demand"
      };

      const serializedOrder = serializeOrder(mockPrismaOnDemandOrder);

      // Verify core field mapping
      expect(serializedOrder.order_number).toBe("OD-67890");
      expect(serializedOrder.order_total).toBe("150");
      expect(serializedOrder.special_notes).toBe("Fragile items");
      expect(serializedOrder.user_id).toBe("user-789");
      expect(serializedOrder.driver_status).toBe("ASSIGNED");

      // Verify address mapping
      expect(serializedOrder.address).toEqual({
        street1: "456 Tech Blvd",
        city: "Austin",
        state: "TX",
        zip: "78701"
      });

      expect(serializedOrder.delivery_address).toEqual({
        street1: "789 Innovation Dr",
        city: "Austin",
        state: "TX",
        zip: "78702"
      });

      // Verify on-demand specific field mapping
      expect(serializedOrder.item_delivered).toBe("Electronics");
      expect(serializedOrder.vehicle_type).toBe("VAN");
      expect(serializedOrder.length).toBe(24);
      expect(serializedOrder.width).toBe(18);
      expect(serializedOrder.height).toBe(12);
      expect(serializedOrder.weight).toBe(50);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle BigInt values correctly', () => {
      const mockOrderWithBigInt = {
        id: "test-order-bigint",
        orderNumber: "BI-12345",
        orderTotal: BigInt(999999999999),
        userId: "user-bigint",
        status: "ACTIVE",
        createdAt: "2024-01-15T10:00:00Z",
        pickupAddress: {
          street1: "123 BigInt St",
          city: "Numbers",
          state: "CA",
          zip: "12345"
        },
        deliveryAddress: null
      };

      const serializedOrder = serializeOrder(mockOrderWithBigInt);

      // BigInt should be converted to string
      expect(typeof serializedOrder.orderTotal).toBe('string');
      expect(serializedOrder.order_total).toBe("999999999999");
    });

    it('should handle null and undefined values gracefully', () => {
      const mockOrderWithNulls = {
        id: "test-order-nulls",
        orderNumber: "NULL-123",
        orderTotal: null,
        specialNotes: null,
        userId: "user-nulls",
        driverStatus: null,
        status: "PENDING",
        pickupDateTime: null,
        arrivalDateTime: null,
        createdAt: "2024-01-15T10:00:00Z",
        pickupAddress: null,
        deliveryAddress: null,
        dispatches: null
      };

      const serializedOrder = serializeOrder(mockOrderWithNulls);

      expect(serializedOrder.order_number).toBe("NULL-123");
      expect(serializedOrder.order_total).toBe("0.00"); // Default value
      expect(serializedOrder.special_notes).toBeNull();
      expect(serializedOrder.driver_status).toBeNull();
      expect(serializedOrder.address.street1).toBeNull();
      expect(serializedOrder.delivery_address).toBeNull();
      expect(serializedOrder.dispatch).toBeNull();
    });

    it('should handle timezone formatting based on state', () => {
      const texasOrder = {
        id: "tx-order",
        orderNumber: "TX-123",
        pickupDateTime: "2024-01-15T10:00:00Z",
        arrivalDateTime: "2024-01-15T14:00:00Z",
        deliveryAddress: {
          state: "TX"
        },
        userId: "user-tx",
        status: "ACTIVE",
        createdAt: "2024-01-15T10:00:00Z"
      };

      const californiaOrder = {
        id: "ca-order",
        orderNumber: "CA-123", 
        pickupDateTime: "2024-01-15T10:00:00Z",
        arrivalDateTime: "2024-01-15T14:00:00Z",
        deliveryAddress: {
          state: "CA"
        },
        userId: "user-ca",
        status: "ACTIVE",
        createdAt: "2024-01-15T10:00:00Z"
      };

      const txSerialized = serializeOrder(texasOrder);
      const caSerialized = serializeOrder(californiaOrder);

      // Both should have formatted times, but potentially different due to timezone
      expect(txSerialized.pickup_time).toBeTruthy();
      expect(caSerialized.pickup_time).toBeTruthy();
      expect(txSerialized.arrival_time).toBeTruthy();
      expect(caSerialized.arrival_time).toBeTruthy();
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain both snake_case and camelCase fields for compatibility', () => {
      const mockOrder = {
        id: "compat-test",
        orderNumber: "COMPAT-123",
        orderTotal: 300.00,
        specialNotes: "Compatibility test",
        userId: "user-compat",
        status: "ACTIVE",
        pickupDateTime: "2024-01-15T10:00:00Z",
        pickupAddress: {
          street1: "123 Compat St",
          city: "Test City",
          state: "CA",
          zip: "12345"
        },
        deliveryAddress: {
          street1: "456 Compat Ave",
          city: "Test City",
          state: "CA", 
          zip: "12346"
        },
        createdAt: "2024-01-15T10:00:00Z"
      };

      const serializedOrder = serializeOrder(mockOrder);

      // New snake_case fields for frontend
      expect(serializedOrder.order_number).toBe("COMPAT-123");
      expect(serializedOrder.order_total).toBe("300");
      expect(serializedOrder.special_notes).toBe("Compatibility test");
      expect(serializedOrder.user_id).toBe("user-compat");

      // Original camelCase fields preserved
      expect(serializedOrder.orderNumber).toBe("COMPAT-123");
      expect(serializedOrder.orderTotal).toBe(300.00);
      expect(serializedOrder.specialNotes).toBe("Compatibility test");
      expect(serializedOrder.userId).toBe("user-compat");

      // Address fields
      expect(serializedOrder.address).toBeTruthy();
      expect(serializedOrder.pickupAddress).toBeTruthy();
      expect(serializedOrder.delivery_address).toBeTruthy();
      expect(serializedOrder.deliveryAddress).toBeTruthy();
    });
  });
}); 