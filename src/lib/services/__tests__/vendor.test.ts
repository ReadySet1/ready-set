import { getVendorOrders } from "../vendor";

// Mock Prisma
const mockPrisma = {
  cateringRequest: {
    findMany: jest.fn(),
  },
  onDemand: {
    findMany: jest.fn(),
  },
};

jest.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

// Mock auth function
const mockGetCurrentUserId = jest.fn();
jest.mock("@/lib/auth", () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

// Override the getCurrentUserId import
jest.mock("../vendor", async (importOriginal) => {
  const mod = await importOriginal() as any;
  return {
    ...mod,
    getCurrentUserId: mockGetCurrentUserId,
  };
});

// Re-import after mocking to get the mocked getCurrentUserId
const vendorModule = await import("../vendor");
const getVendorOrdersActual = vendorModule.getVendorOrders;

describe("getVendorOrders Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUserId.mockResolvedValue("test-user-id");
  });

  it("returns orders with hasMore true when more pages available", async () => {
    const mockCateringOrders = [
      {
        id: "1",
        orderNumber: "CAT-001",
        status: "ACTIVE",
        pickupDateTime: new Date("2024-07-08T10:00:00Z"),
        arrivalDateTime: new Date("2024-07-08T11:00:00Z"),
        orderTotal: 200,
        tip: 20,
        clientAttention: "John Doe",
        pickupAddress: {
          id: "addr1",
          street1: "123 Main St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94102"
        },
        deliveryAddress: {
          id: "addr2",
          street1: "456 Oak St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94103"
        }
      },
      {
        id: "2", 
        orderNumber: "CAT-002",
        status: "PENDING",
        pickupDateTime: new Date("2024-07-08T14:00:00Z"),
        arrivalDateTime: new Date("2024-07-08T15:00:00Z"),
        orderTotal: 150,
        tip: 15,
        clientAttention: "Jane Smith",
        pickupAddress: {
          id: "addr3",
          street1: "789 Pine St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94104"
        },
        deliveryAddress: {
          id: "addr4",
          street1: "321 Elm St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94105"
        }
      }
    ];

    const mockOnDemandOrders = [
      {
        id: "3",
        orderNumber: "OND-001",
        status: "COMPLETED",
        pickupDateTime: new Date("2024-07-07T09:00:00Z"),
        arrivalDateTime: new Date("2024-07-07T10:00:00Z"),
        orderTotal: 300,
        tip: 30,
        clientAttention: "Bob Johnson",
        pickupAddress: {
          id: "addr5",
          street1: "555 Market St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94106"
        },
        deliveryAddress: {
          id: "addr6",
          street1: "777 Broadway",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94107"
        }
      }
    ];

    mockPrisma.cateringRequest.findMany.mockResolvedValue(mockCateringOrders);
    mockPrisma.onDemand.findMany.mockResolvedValue(mockOnDemandOrders);

    // Test with limit 1, page 1 - should have more pages
    const result = await getVendorOrdersActual(1, 1);

    expect(result.orders).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(3);
    expect(result.orders[0]?.orderNumber).toBe("CAT-001"); // Most recent
  });

  it("returns orders with hasMore false when on last page", async () => {
    const mockCateringOrders = [
      {
        id: "1",
        orderNumber: "CAT-001",
        status: "ACTIVE",
        pickupDateTime: new Date("2024-07-08T10:00:00Z"),
        arrivalDateTime: new Date("2024-07-08T11:00:00Z"),
        orderTotal: 200,
        tip: 20,
        clientAttention: "John Doe",
        pickupAddress: {
          id: "addr1",
          street1: "123 Main St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94102"
        },
        deliveryAddress: {
          id: "addr2",
          street1: "456 Oak St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94103"
        }
      }
    ];

    mockPrisma.cateringRequest.findMany.mockResolvedValue(mockCateringOrders);
    mockPrisma.onDemand.findMany.mockResolvedValue([]);

    // Test with limit 5, page 1 - should be last page
    const result = await getVendorOrdersActual(5, 1);

    expect(result.orders).toHaveLength(1);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(1);
  });

  it("sorts orders by pickup date in descending order", async () => {
    const mockCateringOrders = [
      {
        id: "1",
        orderNumber: "CAT-OLD",
        status: "ACTIVE",
        pickupDateTime: new Date("2024-07-06T10:00:00Z"), // Older
        arrivalDateTime: new Date("2024-07-06T11:00:00Z"),
        orderTotal: 200,
        tip: 20,
        clientAttention: "John Doe",
        pickupAddress: {
          id: "addr1",
          street1: "123 Main St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94102"
        },
        deliveryAddress: {
          id: "addr2",
          street1: "456 Oak St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94103"
        }
      }
    ];

    const mockOnDemandOrders = [
      {
        id: "2",
        orderNumber: "OND-NEW",
        status: "PENDING",
        pickupDateTime: new Date("2024-07-08T10:00:00Z"), // Newer
        arrivalDateTime: new Date("2024-07-08T11:00:00Z"),
        orderTotal: 150,
        tip: 15,
        clientAttention: "Jane Smith",
        pickupAddress: {
          id: "addr3",
          street1: "789 Pine St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94104"
        },
        deliveryAddress: {
          id: "addr4",
          street1: "321 Elm St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94105"
        }
      }
    ];

    mockPrisma.cateringRequest.findMany.mockResolvedValue(mockCateringOrders);
    mockPrisma.onDemand.findMany.mockResolvedValue(mockOnDemandOrders);

    const result = await getVendorOrdersActual(10, 1);

    expect(result.orders).toHaveLength(2);
    expect(result.orders[0]?.orderNumber).toBe("OND-NEW"); // Newer order first
    expect(result.orders[1]?.orderNumber).toBe("CAT-OLD"); // Older order second
  });

  it("handles pagination offset correctly", async () => {
    const mockOrders = Array.from({ length: 5 }, (_, i) => ({
      id: `${i + 1}`,
      orderNumber: `ORDER-${i + 1}`,
      status: "ACTIVE",
      pickupDateTime: new Date(`2024-07-${8 - i}T10:00:00Z`), // Descending dates
      arrivalDateTime: new Date(`2024-07-${8 - i}T11:00:00Z`),
      orderTotal: 100 * (i + 1),
      tip: 10 * (i + 1),
      clientAttention: `Client ${i + 1}`,
      pickupAddress: {
        id: `addr${i * 2 + 1}`,
        street1: `${i + 1}00 Main St`,
        street2: null,
        city: "San Francisco",
        state: "CA",
        zip: "94102"
      },
      deliveryAddress: {
        id: `addr${i * 2 + 2}`,
        street1: `${i + 1}00 Oak St`,
        street2: null,
        city: "San Francisco",
        state: "CA",
        zip: "94103"
      }
    }));

    mockPrisma.cateringRequest.findMany.mockResolvedValue(mockOrders);
    mockPrisma.onDemand.findMany.mockResolvedValue([]);

    // Test page 2 with limit 2
    const result = await getVendorOrdersActual(2, 2);

    expect(result.orders).toHaveLength(2);
    expect(result.orders[0]?.orderNumber).toBe("ORDER-3"); // 3rd order (index 2)
    expect(result.orders[1]?.orderNumber).toBe("ORDER-4"); // 4th order (index 3)
    expect(result.hasMore).toBe(true); // Still have ORDER-5
    expect(result.total).toBe(5);
  });

  it("returns empty result when no orders exist", async () => {
    mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
    mockPrisma.onDemand.findMany.mockResolvedValue([]);

    const result = await getVendorOrdersActual(10, 1);

    expect(result.orders).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(0);
  });

  it("throws error when user is not authorized", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    await expect(getVendorOrdersActual(10, 1)).rejects.toThrow("Unauthorized");
  });

  it("uses default parameters when not provided", async () => {
    mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
    mockPrisma.onDemand.findMany.mockResolvedValue([]);

    const result = await getVendorOrdersActual();

    expect(result.orders).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(0);

    // Check that Prisma was called with correct parameters
    expect(mockPrisma.cateringRequest.findMany).toHaveBeenCalledWith({
      where: { userId: "test-user-id" },
      include: {
        pickupAddress: true,
        deliveryAddress: true,
      },
      orderBy: { pickupDateTime: 'desc' },
      take: 50 // fetchLimit = Math.max(10 * 10, 50)
    });
  });

  it("transforms order data correctly", async () => {
    const mockCateringOrder = {
      id: "1",
      orderNumber: "CAT-001",
      status: "ACTIVE",
      pickupDateTime: new Date("2024-07-08T10:00:00Z"),
      arrivalDateTime: new Date("2024-07-08T11:00:00Z"),
      completeDateTime: null,
      orderTotal: "200.50", // String value
      tip: "20.25", // String value
      clientAttention: "John Doe",
      pickupAddress: {
        id: "addr1",
        street1: "123 Main St",
        street2: "Apt 1",
        city: "San Francisco",
        state: "CA",
        zip: "94102"
      },
      deliveryAddress: {
        id: "addr2",
        street1: "456 Oak St",
        street2: null,
        city: "San Francisco",
        state: "CA",
        zip: "94103"
      }
    };

    mockPrisma.cateringRequest.findMany.mockResolvedValue([mockCateringOrder]);
    mockPrisma.onDemand.findMany.mockResolvedValue([]);

    const result = await getVendorOrdersActual(1, 1);

    expect(result.orders[0]).toEqual({
      id: "1",
      orderNumber: "CAT-001",
      orderType: "catering",
      status: "ACTIVE",
      pickupDateTime: "2024-07-08T10:00:00.000Z",
      arrivalDateTime: "2024-07-08T11:00:00.000Z",
      completeDateTime: null,
      orderTotal: 200.5, // Converted to number
      tip: 20.25, // Converted to number
      clientAttention: "John Doe",
      pickupAddress: {
        id: "addr1",
        street1: "123 Main St",
        street2: "Apt 1",
        city: "San Francisco",
        state: "CA",
        zip: "94102"
      },
      deliveryAddress: {
        id: "addr2",
        street1: "456 Oak St",
        street2: null,
        city: "San Francisco",
        state: "CA",
        zip: "94103"
      }
    });
  });

  it("correctly identifies last page when orders equal limit + 1", async () => {
    // Create exactly 2 orders
    const mockOrders = [
      {
        id: "1",
        orderNumber: "ORDER-1",
        status: "ACTIVE",
        pickupDateTime: new Date("2024-07-08T10:00:00Z"),
        arrivalDateTime: new Date("2024-07-08T11:00:00Z"),
        orderTotal: 100,
        tip: 10,
        clientAttention: "Client 1",
        pickupAddress: {
          id: "addr1",
          street1: "100 Main St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94102"
        },
        deliveryAddress: {
          id: "addr2",
          street1: "100 Oak St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94103"
        }
      },
      {
        id: "2",
        orderNumber: "ORDER-2",
        status: "PENDING",
        pickupDateTime: new Date("2024-07-07T10:00:00Z"),
        arrivalDateTime: new Date("2024-07-07T11:00:00Z"),
        orderTotal: 200,
        tip: 20,
        clientAttention: "Client 2",
        pickupAddress: {
          id: "addr3",
          street1: "200 Main St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94102"
        },
        deliveryAddress: {
          id: "addr4",
          street1: "200 Oak St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94103"
        }
      }
    ];

    mockPrisma.cateringRequest.findMany.mockResolvedValue(mockOrders);
    mockPrisma.onDemand.findMany.mockResolvedValue([]);

    // Request page 2 with limit 1 - should be the last page
    const result = await getVendorOrdersActual(1, 2);

    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]?.orderNumber).toBe("ORDER-2");
    expect(result.hasMore).toBe(false); // Should be false since we're on the last order
    expect(result.total).toBe(2);
  });
}); 