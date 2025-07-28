import { NextRequest } from "next/server";
import { POST } from "../route";
import { createClient } from "@/utils/supabase/server";

// Mock Supabase server client
jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

// Mock Prisma client
jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    cateringRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    address: {
      findUnique: jest.fn(),
    },
    fileUpload: {
      create: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

// Mock timezone utility
jest.mock("@/lib/utils/timezone", () => ({
  localTimeToUtc: jest.fn((date, time) => {
    return `${date}T${time}:00.000Z`;
  }),
}));

// Mock Decimal
jest.mock("@/types/prisma", () => ({
  Decimal: jest.fn().mockImplementation((value) => ({
    toNumber: () => parseFloat(value),
    toString: () => value.toString(),
  })),
}));

describe("Catering Requests API", () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  const mockPrismaClient = {
    cateringRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    address: {
      findUnique: jest.fn(),
    },
    fileUpload: {
      create: jest.fn(),
    },
    $disconnect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
    
    // Mock the prisma import
    const { prisma } = require("@/lib/db/prisma");
    Object.assign(prisma, mockPrismaClient);
  });

  describe("POST /api/catering-requests", () => {
    it("should create a new catering request successfully", async () => {
      const mockUser = {
        id: "test-user-id",
        email: "test@example.com",
      };

      const mockAddress = {
        id: "address-1",
        street1: "123 Test St",
        city: "Test City",
        state: "CA",
        zip: "12345",
      };

      const requestBody = {
        orderNumber: "TEST-12345",
        brokerage: "Foodee",
        date: "2025-01-15",
        headcount: "50",
        pickupTime: "10:00",
        arrivalTime: "11:00",
        clientAttention: "John Doe",
        orderTotal: "1000.00",
        pickupAddress: { id: "address-1" },
        deliveryAddress: { id: "address-2" },
        additionalNotes: "Test notes",
        needHost: "NO",
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockPrismaClient.address.findUnique
        .mockResolvedValueOnce(mockAddress) // pickup address
        .mockResolvedValueOnce(mockAddress); // delivery address

      mockPrismaClient.cateringRequest.findUnique.mockResolvedValue(null); // No existing order
      mockPrismaClient.cateringRequest.create.mockResolvedValue({
        id: "order-123",
        status: "ACTIVE",
        ...requestBody,
      });

      // Create a proper NextRequest mock
      const request = new NextRequest("http://localhost:3000/api/catering-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(201);
      expect(responseData.orderNumber).toBe("TEST-12345");
      expect(responseData.orderId).toBe("order-123");
      expect(mockPrismaClient.cateringRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderNumber: "TEST-12345",
          brokerage: "Foodee",
          headcount: 50,
          status: "ACTIVE",
        }),
      });
    });

    it("should return 400 for invalid request data", async () => {
      const mockUser = {
        id: "test-user-id",
        email: "test@example.com",
      };

      const requestBody = {
        // Missing required fields
        orderNumber: "",
        brokerage: "",
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/catering-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.message).toContain("Missing required fields");
    });

    it("should return 409 for duplicate order number", async () => {
      const mockUser = {
        id: "test-user-id",
        email: "test@example.com",
      };

      const requestBody = {
        orderNumber: "DUPLICATE-123",
        brokerage: "Foodee",
        date: "2025-01-15",
        headcount: "50",
        pickupTime: "10:00",
        arrivalTime: "11:00",
        clientAttention: "John Doe",
        orderTotal: "1000.00",
        pickupAddress: { id: "address-1" },
        deliveryAddress: { id: "address-2" },
        needHost: "NO",
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock existing order found
      mockPrismaClient.cateringRequest.findUnique.mockResolvedValue({
        id: "existing-order",
        orderNumber: "DUPLICATE-123",
      });

      const request = new NextRequest("http://localhost:3000/api/catering-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(409);
      expect(responseData.message).toContain("already exists");
    });

    it("should return 401 for unauthenticated requests", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/catering-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.message).toBe("Unauthorized");
    });

    it("should handle database errors gracefully", async () => {
      const mockUser = {
        id: "test-user-id",
        email: "test@example.com",
      };

      const requestBody = {
        orderNumber: "TEST-12345",
        brokerage: "Foodee",
        date: "2025-01-15",
        headcount: "50",
        pickupTime: "10:00",
        arrivalTime: "11:00",
        clientAttention: "John Doe",
        orderTotal: "1000.00",
        pickupAddress: { id: "address-1" },
        deliveryAddress: { id: "address-2" },
        needHost: "NO",
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockPrismaClient.cateringRequest.findUnique.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = new NextRequest("http://localhost:3000/api/catering-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.message).toContain("Failed to process catering request");
    });

    it("should handle host requirements when needHost is YES", async () => {
      const mockUser = {
        id: "test-user-id",
        email: "test@example.com",
      };

      const mockAddress = {
        id: "address-1",
        street1: "123 Test St",
        city: "Test City",
        state: "CA",
        zip: "12345",
      };

      const requestBody = {
        orderNumber: "TEST-HOST-123",
        brokerage: "Foodee",
        date: "2025-01-15",
        headcount: "50",
        pickupTime: "10:00",
        arrivalTime: "11:00",
        clientAttention: "John Doe",
        orderTotal: "1000.00",
        pickupAddress: { id: "address-1" },
        deliveryAddress: { id: "address-2" },
        needHost: "YES",
        hoursNeeded: "4",
        numberOfHosts: "2",
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockPrismaClient.address.findUnique
        .mockResolvedValueOnce(mockAddress) // pickup address
        .mockResolvedValueOnce(mockAddress); // delivery address

      mockPrismaClient.cateringRequest.findUnique.mockResolvedValue(null); // No existing order
      mockPrismaClient.cateringRequest.create.mockResolvedValue({
        id: "order-host-123",
        status: "ACTIVE",
        ...requestBody,
      });

      const request = new NextRequest("http://localhost:3000/api/catering-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(201);
      expect(responseData.orderNumber).toBe("TEST-HOST-123");
      expect(mockPrismaClient.cateringRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          needHost: "YES",
          hoursNeeded: 4,
          numberOfHosts: 2,
        }),
      });
    });
  });
}); 