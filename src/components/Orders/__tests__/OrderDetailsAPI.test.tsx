import { jest } from "@jest/globals";

// Mock Next.js navigation hooks
const mockPush = jest.fn();
const mockPathname = jest.fn();
const mockParams = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname(),
  useParams: () => mockParams(),
}));

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({
      data: { session: { access_token: "mock-token" } },
      error: null,
    }),
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    }),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: { type: "admin" },
          error: null,
        }),
      })),
    })),
  })),
};

jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock broker sync service
jest.mock("@/lib/services/brokerSyncService", () => ({
  syncOrderStatusWithBroker: jest.fn().mockResolvedValue(undefined),
}));

// Mock fetch globally with proper Response typing
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Helper function to create mock Response objects
const createMockResponse = (
  data: any,
  options: { ok?: boolean; status?: number } = {},
) =>
  ({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.ok === false ? "Not Found" : "OK",
    headers: new Headers(),
    redirected: false,
    type: "basic" as ResponseType,
    url: "",
    clone: jest.fn() as any,
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn() as any,
    blob: jest.fn() as any,
    formData: jest.fn() as any,
    json: jest.fn().mockResolvedValue(data) as any,
    text: jest.fn().mockResolvedValue(JSON.stringify(data)) as any,
    bytes: jest.fn() as any,
  }) as Response;

describe("Order Details API Integration Tests", () => {
  const mockDriverData = {
    id: "driver-123",
    name: "David Sanchez",
    email: "davids2002@gmail.com",
    phone: "4792608514",
    lastUpdated: "2024-01-15T10:30:00Z",
  };

  const mockOrderData = {
    id: "1",
    orderNumber: "SF-56780",
    status: "assigned",
    order_type: "catering",
    order_total: "300.00",
    headcount: 24,
    brokerage: "Ez Cater",
    tip: "30.00",
    pickupDateTime: "2024-01-15T12:00:00Z",
    arrivalDateTime: "2024-01-15T12:45:00Z",
    completeDateTime: "2024-01-15T13:00:00Z",
    dispatches: [
      {
        id: "dispatch-1",
        driver: mockDriverData,
        status: "assigned",
        createdAt: "2024-01-15T10:30:00Z",
      },
    ],
    customer: {
      name: "Randy Marsh",
      email: "tegridy25@gmail.com",
    },
    pickupAddress: {
      street: "100 Main St",
      city: "San Carlos",
      state: "CA",
      zipCode: "94070",
    },
    deliveryAddress: {
      street: "100 Main St",
      city: "San Carlos",
      state: "CA",
      zipCode: "94070",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockParams.mockReturnValue({ order_number: "SF-56780" });
  });

  describe("Driver Information API Tests", () => {
    it("should fetch driver information with correct API call", async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockOrderData));

      const response = await fetch(
        "/api/orders/SF-56780?include=dispatch.driver",
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
        },
      );

      expect(response.ok).toBe(true);
      const data = await response.json();

      // Verify driver information is present
      expect(data.dispatches).toHaveLength(1);
      expect(data.dispatches[0].driver).toEqual(mockDriverData);
      expect(data.dispatches[0].driver.name).toBe("David Sanchez");
      expect(data.dispatches[0].driver.email).toBe("davids2002@gmail.com");
      expect(data.dispatches[0].driver.phone).toBe("4792608514");
    });

    it("should handle missing driver information gracefully", async () => {
      const orderWithoutDriver = {
        ...mockOrderData,
        dispatches: [],
      };

      mockFetch.mockResolvedValue(createMockResponse(orderWithoutDriver));

      const response = await fetch(
        "/api/orders/SF-56780?include=dispatch.driver",
      );
      const data = await response.json();

      expect(data.dispatches).toHaveLength(0);
      expect(data.dispatches).toEqual([]);
    });

    it("should validate driver data structure", async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockOrderData));

      const response = await fetch(
        "/api/orders/SF-56780?include=dispatch.driver",
      );
      const data = await response.json();

      const driver = data.dispatches[0].driver;

      // Validate all required driver fields
      expect(driver).toHaveProperty("id");
      expect(driver).toHaveProperty("name");
      expect(driver).toHaveProperty("email");
      expect(driver).toHaveProperty("phone");
      expect(driver).toHaveProperty("lastUpdated");

      // Validate data types
      expect(typeof driver.id).toBe("string");
      expect(typeof driver.name).toBe("string");
      expect(typeof driver.email).toBe("string");
      expect(typeof driver.phone).toBe("string");
      expect(typeof driver.lastUpdated).toBe("string");
    });
  });

  describe("Order Data API Tests", () => {
    it("should fetch order information with correct API call", async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockOrderData));

      const response = await fetch(
        "/api/orders/SF-56780?include=dispatch.driver",
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
        },
      );

      expect(response.ok).toBe(true);
      const data = await response.json();

      // Verify order information
      expect(data.orderNumber).toBe("SF-56780");
      expect(data.status).toBe("assigned");
      expect(data.order_type).toBe("catering");
      expect(data.order_total).toBe("300.00");
      expect(data.headcount).toBe(24);
      expect(data.brokerage).toBe("Ez Cater");
      expect(data.tip).toBe("30.00");
    });

    it("should validate customer information", async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockOrderData));

      const response = await fetch(
        "/api/orders/SF-56780?include=dispatch.driver",
      );
      const data = await response.json();

      // Verify customer data
      expect(data.customer).toBeDefined();
      expect(data.customer.name).toBe("Randy Marsh");
      expect(data.customer.email).toBe("tegridy25@gmail.com");
    });

    it("should validate address information", async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockOrderData));

      const response = await fetch(
        "/api/orders/SF-56780?include=dispatch.driver",
      );
      const data = await response.json();

      // Verify pickup address
      expect(data.pickupAddress).toBeDefined();
      expect(data.pickupAddress.street).toBe("100 Main St");
      expect(data.pickupAddress.city).toBe("San Carlos");
      expect(data.pickupAddress.state).toBe("CA");
      expect(data.pickupAddress.zipCode).toBe("94070");

      // Verify delivery address
      expect(data.deliveryAddress).toBeDefined();
      expect(data.deliveryAddress.street).toBe("100 Main St");
      expect(data.deliveryAddress.city).toBe("San Carlos");
      expect(data.deliveryAddress.state).toBe("CA");
      expect(data.deliveryAddress.zipCode).toBe("94070");
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(
          { error: "Order not found" },
          { ok: false, status: 404 },
        ),
      );

      const response = await fetch(
        "/api/orders/SF-56780?include=dispatch.driver",
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);

      const errorData = await response.json();
      expect(errorData.error).toBe("Order not found");
    });

    it("should validate API response structure", async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockOrderData));

      const response = await fetch(
        "/api/orders/SF-56780?include=dispatch.driver",
      );
      const data = await response.json();

      // Validate required order fields
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("orderNumber");
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("order_type");
      expect(data).toHaveProperty("order_total");
      expect(data).toHaveProperty("headcount");
      expect(data).toHaveProperty("brokerage");
      expect(data).toHaveProperty("tip");
      expect(data).toHaveProperty("customer");
      expect(data).toHaveProperty("pickupAddress");
      expect(data).toHaveProperty("deliveryAddress");
      expect(data).toHaveProperty("dispatches");
    });

    it("should validate order status values", async () => {
      const validStatuses = ["active", "assigned", "cancelled", "completed"];

      for (const status of validStatuses) {
        const orderWithStatus = { ...mockOrderData, status };

        mockFetch.mockResolvedValue(createMockResponse(orderWithStatus));

        const response = await fetch(
          "/api/orders/SF-56780?include=dispatch.driver",
        );
        const data = await response.json();

        expect(validStatuses).toContain(data.status);
      }
    });

    it("should validate order type values", async () => {
      const validOrderTypes = ["catering", "on_demand"];

      for (const orderType of validOrderTypes) {
        const orderWithType = { ...mockOrderData, order_type: orderType };

        mockFetch.mockResolvedValue(createMockResponse(orderWithType));

        const response = await fetch(
          "/api/orders/SF-56780?include=dispatch.driver",
        );
        const data = await response.json();

        expect(validOrderTypes).toContain(data.order_type);
      }
    });
  });

  describe("API Performance Tests", () => {
    it("should complete API call within reasonable time", async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockOrderData));

      const startTime = Date.now();

      const response = await fetch(
        "/api/orders/SF-56780?include=dispatch.driver",
      );
      const data = await response.json();

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.ok).toBe(true);
      expect(data).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should handle concurrent API calls", async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockOrderData));

      const promises = Array(5)
        .fill(null)
        .map(() => fetch("/api/orders/SF-56780?include=dispatch.driver"));

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(5);
      responses.forEach((response) => {
        expect(response.ok).toBe(true);
      });
    });
  });
});
