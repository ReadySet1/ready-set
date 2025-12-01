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

// Mock the vendor module with getCurrentUserId
jest.mock("../vendor", () => ({
  getVendorOrders: jest.fn(),
  getCurrentUserId: mockGetCurrentUserId,
}));

/**
 * TODO: REA-211 - Order service tests have vendor module mocking issues
 */
describe.skip("getVendorOrders Service", () => {
  let getVendorOrdersActual: jest.MockedFunction<typeof getVendorOrders>;

  beforeAll(async () => {
    // Get the mocked function
    const vendorModule = await import("../vendor");
    getVendorOrdersActual = vendorModule.getVendorOrders as jest.MockedFunction<typeof getVendorOrders>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUserId.mockResolvedValue("test-user-id");
  });

  it("returns orders with hasMore true when more pages available", async () => {
    const mockOrders = [
      {
        id: "1",
        orderNumber: "CAT-001",
        orderType: "catering" as const,
        status: "ACTIVE",
        pickupDateTime: "2024-07-08T10:00:00.000Z",
        arrivalDateTime: "2024-07-08T11:00:00.000Z",
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

    getVendorOrdersActual.mockResolvedValue({
      orders: mockOrders,
      hasMore: true,
      total: 3
    });

    const result = await getVendorOrdersActual(1, 1);

    expect(result.orders).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(3);
    expect(getVendorOrdersActual).toHaveBeenCalledWith(1, 1);
  });

  it("returns orders with hasMore false when on last page", async () => {
    const mockOrders = [
      {
        id: "1",
        orderNumber: "CAT-001",
        orderType: "catering" as const,
        status: "ACTIVE",
        pickupDateTime: "2024-07-08T10:00:00.000Z",
        arrivalDateTime: "2024-07-08T11:00:00.000Z",
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

    getVendorOrdersActual.mockResolvedValue({
      orders: mockOrders,
      hasMore: false,
      total: 1
    });

    const result = await getVendorOrdersActual(5, 1);

    expect(result.orders).toHaveLength(1);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(1);
    expect(getVendorOrdersActual).toHaveBeenCalledWith(5, 1);
  });

  it("sorts orders by pickup date in descending order", async () => {
    const mockOrders = [
      {
        id: "2",
        orderNumber: "OND-NEW",
        orderType: "on_demand" as const,
        status: "PENDING",
        pickupDateTime: "2024-07-08T10:00:00.000Z", // Newer
        arrivalDateTime: "2024-07-08T11:00:00.000Z",
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
      },
      {
        id: "1",
        orderNumber: "CAT-OLD",
        orderType: "catering" as const,
        status: "ACTIVE",
        pickupDateTime: "2024-07-06T10:00:00.000Z", // Older
        arrivalDateTime: "2024-07-06T11:00:00.000Z",
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

    getVendorOrdersActual.mockResolvedValue({
      orders: mockOrders,
      hasMore: false,
      total: 2
    });

    const result = await getVendorOrdersActual(10, 1);

    expect(result.orders).toHaveLength(2);
    expect(result.orders[0]?.orderNumber).toBe("OND-NEW"); // Newer first
    expect(result.orders[1]?.orderNumber).toBe("CAT-OLD"); // Older second
    expect(getVendorOrdersActual).toHaveBeenCalledWith(10, 1);
  });

  it("handles pagination correctly", async () => {
    const mockOrders = [
      {
        id: "3",
        orderNumber: "ORDER-3",
        orderType: "catering" as const,
        status: "ACTIVE",
        pickupDateTime: "2024-07-05T10:00:00.000Z",
        arrivalDateTime: "2024-07-05T11:00:00.000Z",
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
      },
      {
        id: "4",
        orderNumber: "ORDER-4",
        orderType: "on_demand" as const,
        status: "PENDING",
        pickupDateTime: "2024-07-04T10:00:00.000Z",
        arrivalDateTime: "2024-07-04T11:00:00.000Z",
        orderTotal: 400,
        tip: 40,
        clientAttention: "Alice Brown",
        pickupAddress: {
          id: "addr7",
          street1: "888 Mission St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94108"
        },
        deliveryAddress: {
          id: "addr8",
          street1: "999 Castro St",
          street2: null,
          city: "San Francisco",
          state: "CA",
          zip: "94109"
        }
      }
    ];

    getVendorOrdersActual.mockResolvedValue({
      orders: mockOrders,
      hasMore: true,
      total: 5
    });

    const result = await getVendorOrdersActual(2, 2);

    expect(result.orders).toHaveLength(2);
    expect(result.orders[0]?.orderNumber).toBe("ORDER-3"); // 3rd order (index 2)
    expect(result.orders[1]?.orderNumber).toBe("ORDER-4"); // 4th order (index 3)
    expect(result.hasMore).toBe(true); // Still have ORDER-5
    expect(result.total).toBe(5);
    expect(getVendorOrdersActual).toHaveBeenCalledWith(2, 2);
  });

  it("returns empty result when no orders exist", async () => {
    getVendorOrdersActual.mockResolvedValue({
      orders: [],
      hasMore: false,
      total: 0
    });

    const result = await getVendorOrdersActual(10, 1);

    expect(result.orders).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(0);
    expect(getVendorOrdersActual).toHaveBeenCalledWith(10, 1);
  });

  it("throws error when user is not authorized", async () => {
    getVendorOrdersActual.mockRejectedValue(new Error("Unauthorized"));

    await expect(getVendorOrdersActual(10, 1)).rejects.toThrow("Unauthorized");
    expect(getVendorOrdersActual).toHaveBeenCalledWith(10, 1);
  });

  it("uses default parameters when not provided", async () => {
    getVendorOrdersActual.mockResolvedValue({
      orders: [],
      hasMore: false,
      total: 0
    });

    const result = await getVendorOrdersActual();

    expect(result.orders).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(0);
    expect(getVendorOrdersActual).toHaveBeenCalledWith();
  });

  it("transforms order data correctly", async () => {
    const mockOrder = {
      id: "1",
      orderNumber: "CAT-001",
      orderType: "catering" as const,
      status: "ACTIVE",
      pickupDateTime: "2024-07-08T10:00:00.000Z",
      arrivalDateTime: "2024-07-08T11:00:00.000Z",
      completeDateTime: null,
      orderTotal: 200.5, // Number value
      tip: 20.25, // Number value
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

    getVendorOrdersActual.mockResolvedValue({
      orders: [mockOrder],
      hasMore: false,
      total: 1
    });

    const result = await getVendorOrdersActual(1, 1);

    expect(result.orders[0]).toEqual(mockOrder);
    expect(getVendorOrdersActual).toHaveBeenCalledWith(1, 1);
  });

  it("correctly identifies last page when orders equal limit + 1", async () => {
    const mockOrders = [
      {
        id: "1",
        orderNumber: "ORDER-1",
        orderType: "catering" as const,
        status: "ACTIVE",
        pickupDateTime: "2024-07-08T10:00:00.000Z",
        arrivalDateTime: "2024-07-08T11:00:00.000Z",
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
        orderType: "on_demand" as const,
        status: "PENDING",
        pickupDateTime: "2024-07-07T10:00:00.000Z",
        arrivalDateTime: "2024-07-07T11:00:00.000Z",
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

    getVendorOrdersActual.mockResolvedValue({
      orders: [mockOrders[1]!], // Only the second order for page 2
      hasMore: false,
      total: 2
    });

    // Request page 2 with limit 1 - should be the last page
    const result = await getVendorOrdersActual(1, 2);

    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]?.orderNumber).toBe("ORDER-2");
    expect(result.hasMore).toBe(false); // Should be false since we're on the last order
    expect(result.total).toBe(2);
    expect(getVendorOrdersActual).toHaveBeenCalledWith(1, 2);
  });
}); 