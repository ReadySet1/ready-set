import { NextRequest } from "next/server";
import { GET } from "../route";

// Mock Prisma client
const mockPrisma = {
  cateringRequest: {
    findUnique: jest.fn(),
  },
};

jest.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

describe("/api/catering-requests/[orderId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("returns order details when order exists", async () => {
      const mockOrder = {
        id: "test-order-id-123",
        orderNumber: "TEST-123",
        status: "ACTIVE",
        driverStatus: "ASSIGNED",
        pickupDateTime: new Date("2025-08-01T16:15:00Z"),
        arrivalDateTime: new Date("2025-08-01T16:45:00Z"),
        completeDateTime: new Date("2025-08-01T17:00:00Z"),
        updatedAt: new Date("2025-07-28T17:40:00Z"),
        headcount: 12,
        needHost: "YES",
        hoursNeeded: 3,
        numberOfHosts: 3,
        brokerage: "Platterz",
        orderTotal: "130.00",
        tip: "15.00",
        clientAttention: "Rachel Sanz",
        pickupNotes: "Testing Order",
        specialNotes: null,
        pickupAddress: {
          street1: "3 Santa Ana Av",
          street2: null,
          city: "San Bruno",
          state: "California",
          zip: "94020",
          locationNumber: null,
          parkingLoading: null,
        },
        deliveryAddress: {
          street1: "3 Santa Ana Av",
          street2: null,
          city: "San Bruno",
          state: "California",
          zip: "94020",
          locationNumber: null,
          parkingLoading: null,
        },
        dispatches: [
          {
            id: "dispatch-1",
            driverId: "driver-1",
            createdAt: new Date("2025-07-28T17:40:00Z"),
            driver: {
              id: "driver-1",
              name: "John Driver",
              contactNumber: "555-1234",
            },
          },
        ],
      };

      mockPrisma.cateringRequest.findUnique.mockResolvedValue(mockOrder);

      const request = new NextRequest("http://localhost:3000/api/catering-requests/test-order-id-123");
      const response = await GET(request, { params: { orderId: "test-order-id-123" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.order.id).toBe("test-order-id-123");
      expect(data.order.orderNumber).toBe("TEST-123");
      expect(data.order.status).toBe("ACTIVE");
      expect(data.order.brokerage).toBe("Platterz");
      expect(data.order.clientAttention).toBe("Rachel Sanz");
      expect(data.order.headcount).toBe(12);
      expect(data.order.needHost).toBe("YES");
      expect(data.order.hoursNeeded).toBe(3);
      expect(data.order.numberOfHosts).toBe(3);
      expect(data.order.orderTotal).toBe("130.00");
      expect(data.order.tip).toBe("15.00");
      expect(data.order.pickupNotes).toBe("Testing Order");
      expect(data.order.specialNotes).toBeNull();
      expect(data.order.pickupAddress).toBeDefined();
      expect(data.order.deliveryAddress).toBeDefined();
      expect(data.order.dispatches).toHaveLength(1);
      expect(data.order.dispatches[0].driver.name).toBe("John Driver");
      expect(data.order.dispatches[0].driver.contactNumber).toBe("555-1234");
    });

    it("returns 404 when order does not exist", async () => {
      mockPrisma.cateringRequest.findUnique.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/catering-requests/non-existent-id");
      const response = await GET(request, { params: { orderId: "non-existent-id" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Order not found");
    });

    it("returns 500 when database error occurs", async () => {
      mockPrisma.cateringRequest.findUnique.mockRejectedValue(new Error("Database error"));

      const request = new NextRequest("http://localhost:3000/api/catering-requests/test-order-id-123");
      const response = await GET(request, { params: { orderId: "test-order-id-123" } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Failed to fetch order details");
    });

    it("handles order without host services", async () => {
      const mockOrderWithoutHost = {
        id: "test-order-id-123",
        orderNumber: "TEST-123",
        status: "ACTIVE",
        driverStatus: "ASSIGNED",
        pickupDateTime: new Date("2025-08-01T16:15:00Z"),
        arrivalDateTime: new Date("2025-08-01T16:45:00Z"),
        completeDateTime: new Date("2025-08-01T17:00:00Z"),
        updatedAt: new Date("2025-07-28T17:40:00Z"),
        headcount: 12,
        needHost: "NO",
        hoursNeeded: null,
        numberOfHosts: null,
        brokerage: "Platterz",
        orderTotal: "130.00",
        tip: "15.00",
        clientAttention: "Rachel Sanz",
        pickupNotes: "Testing Order",
        specialNotes: null,
        pickupAddress: {
          street1: "3 Santa Ana Av",
          street2: null,
          city: "San Bruno",
          state: "California",
          zip: "94020",
          locationNumber: null,
          parkingLoading: null,
        },
        deliveryAddress: {
          street1: "3 Santa Ana Av",
          street2: null,
          city: "San Bruno",
          state: "California",
          zip: "94020",
          locationNumber: null,
          parkingLoading: null,
        },
        dispatches: [],
      };

      mockPrisma.cateringRequest.findUnique.mockResolvedValue(mockOrderWithoutHost);

      const request = new NextRequest("http://localhost:3000/api/catering-requests/test-order-id-123");
      const response = await GET(request, { params: { orderId: "test-order-id-123" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.order.needHost).toBe("NO");
      expect(data.order.hoursNeeded).toBeNull();
      expect(data.order.numberOfHosts).toBeNull();
      expect(data.order.dispatches).toHaveLength(0);
    });

    it("handles order without notes", async () => {
      const mockOrderWithoutNotes = {
        id: "test-order-id-123",
        orderNumber: "TEST-123",
        status: "ACTIVE",
        driverStatus: "ASSIGNED",
        pickupDateTime: new Date("2025-08-01T16:15:00Z"),
        arrivalDateTime: new Date("2025-08-01T16:45:00Z"),
        completeDateTime: new Date("2025-08-01T17:00:00Z"),
        updatedAt: new Date("2025-07-28T17:40:00Z"),
        headcount: 12,
        needHost: "NO",
        hoursNeeded: null,
        numberOfHosts: null,
        brokerage: "Platterz",
        orderTotal: "130.00",
        tip: "15.00",
        clientAttention: "Rachel Sanz",
        pickupNotes: null,
        specialNotes: null,
        pickupAddress: {
          street1: "3 Santa Ana Av",
          street2: null,
          city: "San Bruno",
          state: "California",
          zip: "94020",
          locationNumber: null,
          parkingLoading: null,
        },
        deliveryAddress: {
          street1: "3 Santa Ana Av",
          street2: null,
          city: "San Bruno",
          state: "California",
          zip: "94020",
          locationNumber: null,
          parkingLoading: null,
        },
        dispatches: [],
      };

      mockPrisma.cateringRequest.findUnique.mockResolvedValue(mockOrderWithoutNotes);

      const request = new NextRequest("http://localhost:3000/api/catering-requests/test-order-id-123");
      const response = await GET(request, { params: { orderId: "test-order-id-123" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.order.pickupNotes).toBeNull();
      expect(data.order.specialNotes).toBeNull();
    });

    it("handles order with missing address information", async () => {
      const mockOrderWithMissingAddress = {
        id: "test-order-id-123",
        orderNumber: "TEST-123",
        status: "ACTIVE",
        driverStatus: "ASSIGNED",
        pickupDateTime: new Date("2025-08-01T16:15:00Z"),
        arrivalDateTime: new Date("2025-08-01T16:45:00Z"),
        completeDateTime: new Date("2025-08-01T17:00:00Z"),
        updatedAt: new Date("2025-07-28T17:40:00Z"),
        headcount: 12,
        needHost: "NO",
        hoursNeeded: null,
        numberOfHosts: null,
        brokerage: "Platterz",
        orderTotal: "130.00",
        tip: "15.00",
        clientAttention: "Rachel Sanz",
        pickupNotes: null,
        specialNotes: null,
        pickupAddress: null,
        deliveryAddress: null,
        dispatches: [],
      };

      mockPrisma.cateringRequest.findUnique.mockResolvedValue(mockOrderWithMissingAddress);

      const request = new NextRequest("http://localhost:3000/api/catering-requests/test-order-id-123");
      const response = await GET(request, { params: { orderId: "test-order-id-123" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.order.pickupAddress).toBeNull();
      expect(data.order.deliveryAddress).toBeNull();
    });

    it("validates orderId parameter", async () => {
      const request = new NextRequest("http://localhost:3000/api/catering-requests/");
      const response = await GET(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Order ID is required");
    });

    it("handles invalid orderId format", async () => {
      const request = new NextRequest("http://localhost:3000/api/catering-requests/invalid-id");
      const response = await GET(request, { params: { orderId: "invalid-id" } });
      const data = await response.json();

      // The endpoint should still try to find the order even with invalid format
      expect(mockPrisma.cateringRequest.findUnique).toHaveBeenCalledWith({
        where: { id: "invalid-id" },
        include: {
          user: true,
          pickupAddress: true,
          deliveryAddress: true,
          dispatches: {
            include: {
              driver: true,
            },
          },
        },
      });
    });
  });
}); 