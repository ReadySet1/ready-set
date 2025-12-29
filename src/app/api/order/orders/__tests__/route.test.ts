import { GET } from "../route";
import { createGetRequest, createRequestWithParams } from "@/__tests__/helpers/api-test-helpers";

// Mock the vendor service - using jest.fn() directly in mock to avoid hoisting issues
jest.mock("@/lib/services/vendor", () => ({
  getUserOrders: jest.fn(),
  checkOrderAccess: jest.fn(),
}));

// Import mocked functions after the mock is defined
import { getUserOrders, checkOrderAccess } from "@/lib/services/vendor";
const mockGetUserOrders = getUserOrders as jest.MockedFunction<typeof getUserOrders>;
const mockCheckOrderAccess = checkOrderAccess as jest.MockedFunction<typeof checkOrderAccess>;

describe("Vendor Orders API Route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckOrderAccess.mockResolvedValue(true);
  });

  it("returns orders with pagination metadata for valid request", async () => {
    const mockOrdersResult = {
      orders: [
        {
          id: "1",
          orderNumber: "TEST-001",
          orderType: "catering" as const,
          status: "ACTIVE",
          pickupDateTime: "2024-07-08T10:00:00Z",
          arrivalDateTime: "2024-07-08T11:00:00Z",
          orderTotal: 200.00,
          tip: 20.00,
          pickupAddress: {
            id: "addr-1",
            street1: "123 Main St",
            city: "Test City",
            state: "CA",
            zip: "12345",
          },
          deliveryAddress: {
            id: "addr-2",
            street1: "456 Oak Ave",
            city: "Test City",
            state: "CA",
            zip: "12346",
          },
        }
      ],
      hasMore: true,
      total: 5
    };

    mockGetUserOrders.mockResolvedValue(mockOrdersResult);

    const request = createRequestWithParams("http://localhost/api/vendor/orders", { page: 1, limit: 1 });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      orders: mockOrdersResult.orders,
      hasMore: true,
      total: 5,
      page: 1,
      limit: 1
    });

    expect(mockGetUserOrders).toHaveBeenCalledWith(1, 1);
  });

  it("uses default pagination values when not provided", async () => {
    const mockOrdersResult = {
      orders: [],
      hasMore: false,
      total: 0
    };

    mockGetUserOrders.mockResolvedValue(mockOrdersResult);

    const request = createGetRequest("http://localhost/api/vendor/orders");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(10);
    expect(mockGetUserOrders).toHaveBeenCalledWith(10, 1);
  });

  it("handles page parameter correctly", async () => {
    const mockOrdersResult = {
      orders: [],
      hasMore: false,
      total: 0
    };

    mockGetUserOrders.mockResolvedValue(mockOrdersResult);

    const request = createRequestWithParams("http://localhost/api/vendor/orders", { page: 3 });

    await GET(request);

    expect(mockGetUserOrders).toHaveBeenCalledWith(10, 3);
  });

  it("handles limit parameter correctly", async () => {
    const mockOrdersResult = {
      orders: [],
      hasMore: false,
      total: 0
    };

    mockGetUserOrders.mockResolvedValue(mockOrdersResult);

    const request = createRequestWithParams("http://localhost/api/vendor/orders", { limit: 5 });

    await GET(request);

    expect(mockGetUserOrders).toHaveBeenCalledWith(5, 1);
  });

  it("handles both page and limit parameters", async () => {
    const mockOrdersResult = {
      orders: [],
      hasMore: true,
      total: 15
    };

    mockGetUserOrders.mockResolvedValue(mockOrdersResult);

    const request = createRequestWithParams("http://localhost/api/vendor/orders", { page: 2, limit: 5 });

    const response = await GET(request);
    const data = await response.json();

    expect(data.page).toBe(2);
    expect(data.limit).toBe(5);
    expect(mockGetUserOrders).toHaveBeenCalledWith(5, 2);
  });

  it("returns 403 when vendor access is denied", async () => {
    mockCheckOrderAccess.mockResolvedValue(false);

    const request = createGetRequest("http://localhost/api/vendor/orders");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Unauthorized access");
    expect(mockGetUserOrders).not.toHaveBeenCalled();
  });

  it("handles service errors gracefully", async () => {
    mockGetUserOrders.mockRejectedValue(new Error("Database connection failed"));

    const request = createGetRequest("http://localhost/api/vendor/orders");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database connection failed");
  });

  it("handles service errors without message", async () => {
    mockGetUserOrders.mockRejectedValue(new Error());

    const request = createGetRequest("http://localhost/api/vendor/orders");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch vendor orders");
  });

  it("parses invalid page parameter as default", async () => {
    const mockOrdersResult = {
      orders: [],
      hasMore: false,
      total: 0
    };

    mockGetUserOrders.mockResolvedValue(mockOrdersResult);

    const request = createRequestWithParams("http://localhost/api/vendor/orders", { page: "invalid" });

    const response = await GET(request);
    const data = await response.json();

    expect(data.page).toBe(1); // Should default to 1 for invalid input (NaN becomes falsy, defaults to 1)
    expect(mockGetUserOrders).toHaveBeenCalledWith(10, 1);
  });

  it("parses invalid limit parameter as default", async () => {
    const mockOrdersResult = {
      orders: [],
      hasMore: false,
      total: 0
    };

    mockGetUserOrders.mockResolvedValue(mockOrdersResult);

    const request = createRequestWithParams("http://localhost/api/vendor/orders", { limit: "invalid" });

    const response = await GET(request);
    const data = await response.json();

    expect(data.limit).toBe(10); // Should default to 10 for invalid input (NaN becomes falsy, defaults to 10)
    expect(mockGetUserOrders).toHaveBeenCalledWith(10, 1);
  });

  it("returns correct hasMore flag for last page", async () => {
    const mockOrdersResult = {
      orders: [
        {
          id: "1",
          orderNumber: "TEST-001",
          orderType: "catering" as const,
          status: "ACTIVE",
          pickupDateTime: "2024-01-15T10:00:00Z",
          arrivalDateTime: "2024-01-15T12:00:00Z",
          orderTotal: 250.00,
          pickupAddress: {
            id: "pickup-1",
            street1: "123 Main St",
            city: "San Jose",
            state: "CA",
            zip: "95113"
          },
          deliveryAddress: {
            id: "delivery-1", 
            street1: "456 Oak Ave",
            city: "San Jose",
            state: "CA",
            zip: "95112"
          }
        }
      ],
      hasMore: false, // Last page
      total: 3
    };

    mockGetUserOrders.mockResolvedValue(mockOrdersResult);

    const request = createRequestWithParams("http://localhost/api/vendor/orders", { page: 3, limit: 1 });

    const response = await GET(request);
    const data = await response.json();

    expect(data.hasMore).toBe(false);
    expect(data.page).toBe(3);
    expect(data.total).toBe(3);
  });

  it("returns correct hasMore flag for middle page", async () => {
    const mockOrdersResult = {
      orders: [
        {
          id: "2",
          orderNumber: "TEST-002",
          orderType: "on_demand" as const,
          status: "PENDING",
          pickupDateTime: "2024-01-16T14:00:00Z",
          arrivalDateTime: "2024-01-16T16:00:00Z",
          orderTotal: 180.00,
          pickupAddress: {
            id: "pickup-2",
            street1: "789 Pine St",
            city: "San Jose",
            state: "CA",
            zip: "95114"
          },
          deliveryAddress: {
            id: "delivery-2",
            street1: "321 Elm St",
            city: "San Jose",
            state: "CA",
            zip: "95115"
          }
        }
      ],
      hasMore: true, // More pages available
      total: 5
    };

    mockGetUserOrders.mockResolvedValue(mockOrdersResult);

    const request = createRequestWithParams("http://localhost/api/vendor/orders", { page: 2, limit: 1 });

    const response = await GET(request);
    const data = await response.json();

    expect(data.hasMore).toBe(true);
    expect(data.page).toBe(2);
    expect(data.total).toBe(5);
  });
}); 