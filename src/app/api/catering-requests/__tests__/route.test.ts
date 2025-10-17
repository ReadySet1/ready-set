/**
 * Tests for /api/catering-requests route
 *
 * This route is REVENUE CRITICAL as it creates catering orders
 *
 * Tests cover:
 * - POST: Creating catering requests with validation
 * - Authentication enforcement
 * - Soft-delete protection
 * - Address validation
 * - Duplicate order number detection
 * - File attachment processing
 * - Email notification handling
 * - Error handling
 */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { validateUserNotSoftDeleted } from "@/lib/soft-delete-handlers";
import {
  createPostRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectValidationError,
  expectErrorResponse,
  expectForbidden,
  expectServerError,
} from "@/__tests__/helpers/api-test-helpers";

// Mock dependencies
jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    cateringRequest: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    address: {
      findUnique: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
    },
    fileUpload: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/soft-delete-handlers", () => ({
  validateUserNotSoftDeleted: jest.fn(),
}));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: "email-id" }),
    },
  })),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockPrisma = prisma as any;
const mockValidateUserNotSoftDeleted = validateUserNotSoftDeleted as jest.MockedFunction<typeof validateUserNotSoftDeleted>;

describe("/api/catering-requests", () => {
  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
    aud: "authenticated",
    role: "authenticated",
  };

  const mockPickupAddress = {
    id: "pickup-addr-id",
    street1: "123 Pickup St",
    street2: null,
    city: "San Francisco",
    state: "CA",
    zip: "94102",
  };

  const mockDeliveryAddress = {
    id: "delivery-addr-id",
    street1: "456 Delivery Ave",
    street2: null,
    city: "San Francisco",
    state: "CA",
    zip: "94103",
  };

  const validCateringData = {
    orderNumber: "CAT001",
    brokerage: "TestCatering",
    date: "2025-01-20",
    pickupTime: "10:00",
    arrivalTime: "11:00",
    headcount: 50,
    needHost: "NO",
    clientAttention: "John Doe",
    orderTotal: "250.00",
    pickupAddress: {
      id: mockPickupAddress.id,
    },
    deliveryAddress: {
      id: mockDeliveryAddress.id,
    },
    pickupNotes: "Call on arrival",
    specialNotes: "Vegetarian options preferred",
  };

  const mockCateringRequest = {
    id: "catering-id",
    orderNumber: validCateringData.orderNumber,
    userId: mockUser.id,
    brokerage: validCateringData.brokerage,
    pickupAddressId: mockPickupAddress.id,
    deliveryAddressId: mockDeliveryAddress.id,
    pickupDateTime: new Date("2025-01-20T10:00:00Z"),
    arrivalDateTime: new Date("2025-01-20T11:00:00Z"),
    headcount: validCateringData.headcount,
    needHost: validCateringData.needHost,
    hoursNeeded: null,
    numberOfHosts: null,
    clientAttention: validCateringData.clientAttention,
    orderTotal: validCateringData.orderTotal,
    tip: "0",
    status: "ACTIVE",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated user
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    } as any);

    // Default: user not soft-deleted
    mockValidateUserNotSoftDeleted.mockResolvedValue({
      isValid: true,
      error: null,
    });

    // Default: no existing order
    mockPrisma.cateringRequest.findUnique.mockResolvedValue(null);

    // Default: addresses exist
    mockPrisma.address.findUnique.mockImplementation((params: any) => {
      if (params.where.id === mockPickupAddress.id) {
        return Promise.resolve(mockPickupAddress);
      }
      if (params.where.id === mockDeliveryAddress.id) {
        return Promise.resolve(mockDeliveryAddress);
      }
      return Promise.resolve(null);
    });

    // Default: profile exists
    mockPrisma.profile.findUnique.mockResolvedValue({
      id: mockUser.id,
      email: mockUser.email,
      name: "Test User",
    });

    // Default: successful catering request creation
    mockPrisma.cateringRequest.create.mockResolvedValue(mockCateringRequest);
  });

  describe("POST /api/catering-requests", () => {
    it("should return 401 when not authenticated", async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      } as any);

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        validCateringData
      );

      const response = await POST(request);
      await expectUnauthorized(response, "Unauthorized");
    });

    it("should return 403 when user is soft-deleted", async () => {
      mockValidateUserNotSoftDeleted.mockResolvedValue({
        isValid: false,
        error: "User account has been deleted",
      });

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        validCateringData
      );

      const response = await POST(request);
      await expectForbidden(response);
    });

    it("should require orderNumber field", async () => {
      const { orderNumber, ...dataWithoutOrderNumber } = validCateringData;

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithoutOrderNumber
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("orderNumber");
    });

    it("should require brokerage field", async () => {
      const { brokerage, ...dataWithoutBrokerage } = validCateringData;

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithoutBrokerage
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("brokerage");
    });

    it("should require date field", async () => {
      const { date, ...dataWithoutDate } = validCateringData;

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithoutDate
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("date");
    });

    it("should require pickupTime field", async () => {
      const { pickupTime, ...dataWithoutPickupTime } = validCateringData;

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithoutPickupTime
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("pickupTime");
    });

    it("should require arrivalTime field", async () => {
      const { arrivalTime, ...dataWithoutArrivalTime } = validCateringData;

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithoutArrivalTime
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("arrivalTime");
    });

    it("should require headcount field", async () => {
      const { headcount, ...dataWithoutHeadcount } = validCateringData;

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithoutHeadcount
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("headcount");
    });

    it("should require needHost field", async () => {
      const { needHost, ...dataWithoutNeedHost } = validCateringData;

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithoutNeedHost
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("needHost");
    });

    it("should require clientAttention field", async () => {
      const { clientAttention, ...dataWithoutClientAttention } = validCateringData;

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithoutClientAttention
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("clientAttention");
    });

    it("should require orderTotal field", async () => {
      const { orderTotal, ...dataWithoutOrderTotal } = validCateringData;

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithoutOrderTotal
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("orderTotal");
    });

    it("should require pickupAddress.id field", async () => {
      const dataWithoutPickupAddressId = {
        ...validCateringData,
        pickupAddress: {},
      };

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithoutPickupAddressId
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("pickupAddress.id");
    });

    it("should require deliveryAddress.id field", async () => {
      const dataWithoutDeliveryAddressId = {
        ...validCateringData,
        deliveryAddress: {},
      };

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithoutDeliveryAddressId
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("deliveryAddress.id");
    });

    it("should require hoursNeeded when needHost is YES", async () => {
      const dataWithHost = {
        ...validCateringData,
        needHost: "YES",
        numberOfHosts: 2,
        // missing hoursNeeded
      };

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithHost
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("hoursNeeded");
    });

    it("should require numberOfHosts when needHost is YES", async () => {
      const dataWithHost = {
        ...validCateringData,
        needHost: "YES",
        hoursNeeded: 3,
        // missing numberOfHosts
      };

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithHost
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("numberOfHosts");
    });

    it("should return 409 when order number already exists", async () => {
      mockPrisma.cateringRequest.findUnique.mockResolvedValue({
        id: "existing-id",
        orderNumber: validCateringData.orderNumber,
      });

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        validCateringData
      );

      const response = await POST(request);
      const data = await expectErrorResponse(response, 409);
      expect(data.message).toContain("order number already exists");
    });

    it("should return 400 when pickup address does not exist", async () => {
      mockPrisma.address.findUnique.mockImplementation((params: any) => {
        if (params.where.id === mockPickupAddress.id) {
          return Promise.resolve(null); // Pickup address not found
        }
        if (params.where.id === mockDeliveryAddress.id) {
          return Promise.resolve(mockDeliveryAddress);
        }
        return Promise.resolve(null);
      });

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        validCateringData
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Pickup address");
      expect(data.message).toContain("not found");
    });

    it("should return 400 when delivery address does not exist", async () => {
      mockPrisma.address.findUnique.mockImplementation((params: any) => {
        if (params.where.id === mockPickupAddress.id) {
          return Promise.resolve(mockPickupAddress);
        }
        if (params.where.id === mockDeliveryAddress.id) {
          return Promise.resolve(null); // Delivery address not found
        }
        return Promise.resolve(null);
      });

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        validCateringData
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Delivery address");
      expect(data.message).toContain("not found");
    });

    it("should create catering request successfully", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        validCateringData
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 201);

      expect(data.message).toContain("created successfully");
      expect(data).toHaveProperty("orderId");
      expect(data).toHaveProperty("emailSent");
    });

    it("should set userId from authenticated user", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        validCateringData
      );

      await POST(request);

      expect(mockPrisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
          }),
        })
      );
    });

    it("should use clientId from request when in admin mode", async () => {
      const dataWithClientId = {
        ...validCateringData,
        clientId: "admin-specified-client-id",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithClientId
      );

      await POST(request);

      expect(mockPrisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "admin-specified-client-id",
          }),
        })
      );
    });

    it("should set status to ACTIVE for new orders", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        validCateringData
      );

      await POST(request);

      expect(mockPrisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "ACTIVE",
          }),
        })
      );
    });

    it("should generate a UUID for the order", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        validCateringData
      );

      await POST(request);

      expect(mockPrisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: expect.any(String),
          }),
        })
      );
    });

    it("should process file attachments", async () => {
      const dataWithAttachments = {
        ...validCateringData,
        attachments: [
          {
            name: "invoice.pdf",
            url: "https://example.com/invoice.pdf",
            size: 1024,
            type: "application/pdf",
          },
          {
            name: "menu.jpg",
            key: "uploads/menu.jpg",
            size: 2048,
            type: "image/jpeg",
          },
        ],
      };

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithAttachments
      );

      await POST(request);

      expect(mockPrisma.fileUpload.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.fileUpload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fileName: "invoice.pdf",
            fileUrl: "https://example.com/invoice.pdf",
            category: "catering",
          }),
        })
      );
    });

    it("should not fail if email sending fails", async () => {
      // Mock email failure by making profile lookup fail
      mockPrisma.profile.findUnique.mockRejectedValue(
        new Error("Database error")
      );

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        validCateringData
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 201);

      expect(data.message).toContain("created successfully");
      expect(data.emailSent).toBe(false);
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.cateringRequest.create.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        validCateringData
      );

      const response = await POST(request);
      await expectServerError(response);
    });

    it("should convert dates and times to UTC", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        validCateringData
      );

      await POST(request);

      expect(mockPrisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pickupDateTime: expect.any(Date),
            arrivalDateTime: expect.any(Date),
          }),
        })
      );
    });

    it("should handle completeTime when provided", async () => {
      const dataWithCompleteTime = {
        ...validCateringData,
        completeTime: "12:00",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithCompleteTime
      );

      await POST(request);

      expect(mockPrisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completeDateTime: expect.any(Date),
          }),
        })
      );
    });

    it("should set hoursNeeded and numberOfHosts when needHost is YES", async () => {
      const dataWithHost = {
        ...validCateringData,
        needHost: "YES",
        hoursNeeded: 3,
        numberOfHosts: 2,
      };

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithHost
      );

      await POST(request);

      expect(mockPrisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hoursNeeded: 3,
            numberOfHosts: 2,
          }),
        })
      );
    });

    it("should handle tip field when provided", async () => {
      const dataWithTip = {
        ...validCateringData,
        tip: "25.00",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithTip
      );

      await POST(request);

      expect(mockPrisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tip: expect.any(Object), // Decimal object
          }),
        })
      );
    });
  });
});
