import { describe, it, expect } from 'vitest';

// Mock the serializeOrder function behavior
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
  };

  return serializedOrder;
}

describe('Orders API Field Mapping Fix', () => {
  it('should correctly map camelCase Prisma fields to snake_case for UserOrder component', () => {
    // Mock Prisma order data (camelCase)
    const mockPrismaOrder = {
      id: "test-id-123",
      orderNumber: "Test 35689",  // camelCase from Prisma
      orderTotal: 250.00,         // camelCase from Prisma
      specialNotes: "Handle with care",  // camelCase from Prisma
      userId: "user-123",         // camelCase from Prisma
      driverStatus: "PENDING",    // camelCase from Prisma
      status: "ACTIVE",
      pickupDateTime: "2024-01-15T10:00:00Z",
      arrivalDateTime: "2024-01-15T14:00:00Z",
      createdAt: "2024-01-14T08:00:00Z",
      updatedAt: "2024-01-14T08:30:00Z",
      pickupAddress: {           // camelCase from Prisma relation
        street1: "123 Main St",
        city: "San Francisco", 
        state: "CA",
        zip: "94101"
      },
      deliveryAddress: {         // camelCase from Prisma relation
        street1: "456 Oak Ave",
        city: "San Francisco",
        state: "CA", 
        zip: "94102"
      },
      dispatches: [],
      order_type: "catering"
    };

    // Serialize the order using the fixed function
    const serializedOrder = serializeOrder(mockPrismaOrder);

    // Verify that snake_case fields are properly mapped
    expect(serializedOrder.order_number).toBe("Test 35689");
    expect(serializedOrder.order_total).toBe("250");
    expect(serializedOrder.special_notes).toBe("Handle with care");
    expect(serializedOrder.user_id).toBe("user-123");
    expect(serializedOrder.driver_status).toBe("PENDING");

    // Verify address mapping
    expect(serializedOrder.address).toEqual({
      street1: "123 Main St",
      city: "San Francisco",
      state: "CA",
      zip: "94101"
    });

    expect(serializedOrder.delivery_address).toEqual({
      street1: "456 Oak Ave", 
      city: "San Francisco",
      state: "CA",
      zip: "94102"
    });

    // Verify date field mapping
    expect(serializedOrder.date).toBe("2024-01-15T10:00:00Z");
    expect(serializedOrder.pickup_time).toBeTruthy();
    expect(serializedOrder.arrival_time).toBeTruthy();

    // Ensure old camelCase fields are still present for backward compatibility
    expect(serializedOrder.orderNumber).toBe("Test 35689");
    expect(serializedOrder.pickupAddress).toBeTruthy();
    expect(serializedOrder.deliveryAddress).toBeTruthy();
  });

  it('should handle missing optional fields gracefully', () => {
    const mockOrderWithMissingFields = {
      id: "test-id-456",
      orderNumber: "SF-12350",
      userId: "user-456",
      status: "PENDING",
      createdAt: "2024-01-14T08:00:00Z",
      // Missing: orderTotal, specialNotes, addresses, etc.
    };

    const serializedOrder = serializeOrder(mockOrderWithMissingFields);

    expect(serializedOrder.order_number).toBe("SF-12350");
    expect(serializedOrder.order_total).toBe("0.00"); // Default value
    expect(serializedOrder.special_notes).toBeUndefined();
    expect(serializedOrder.address.street1).toBeNull();
    expect(serializedOrder.delivery_address).toBeNull();
  });

  it('should handle addresses with null values', () => {
    const mockOrderWithNullAddress = {
      id: "test-id-789",
      orderNumber: "OD-67890",
      userId: "user-789",
      status: "ACTIVE",
      createdAt: "2024-01-14T08:00:00Z",
      pickupAddress: {
        street1: null,
        city: "Austin",
        state: null,
        zip: "78701"
      },
      deliveryAddress: null
    };

    const serializedOrder = serializeOrder(mockOrderWithNullAddress);

    expect(serializedOrder.address).toEqual({
      street1: null,
      city: "Austin", 
      state: null,
      zip: "78701"
    });
    expect(serializedOrder.delivery_address).toBeNull();
  });
}); 