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

jest.mock("@/services/orders/notifyOrderCreated");
import { notifyOrderCreated } from "@/services/orders/notifyOrderCreated";
jest.mock("@/lib/api/after-response", () => ({
  runAfterResponse: jest.fn((_label: string, work: () => Promise<unknown>) => { void work(); }),
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

    it("should accept order with headcount only (no orderTotal)", async () => {
      const { orderTotal, ...dataWithHeadcountOnly } = validCateringData;

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithHeadcountOnly
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 201);
      expect(data.message).toContain("created successfully");

      // Verify null orderTotal reaches Prisma (not omitted, not 0)
      expect(mockPrisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            headcount: 50,
            orderTotal: null,
          }),
        })
      );
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

    it("should accept order with orderTotal only (no headcount)", async () => {
      const { headcount, ...dataWithOrderTotalOnly } = validCateringData;

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithOrderTotalOnly
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 201);
      expect(data.message).toContain("created successfully");

      // Verify null headcount reaches Prisma
      expect(mockPrisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            headcount: null,
            orderTotal: expect.any(Object), // Decimal
          }),
        })
      );
    });

    it("should return 400 when both headcount and orderTotal are blank", async () => {
      const { headcount, orderTotal, ...dataWithoutBoth } = validCateringData;

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithoutBoth
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Provide at least one: Headcount or Order Total.");
    });

    it("should store null orderTotal when orderTotal is empty string", async () => {
      const dataWithEmptyOrderTotal = {
        ...validCateringData,
        orderTotal: "",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithEmptyOrderTotal
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 201);

      // headcount is 50, so at-least-one passes; orderTotal "" → null
      expect(mockPrisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            headcount: 50,
            orderTotal: null,
          }),
        })
      );
    });

    it("should return 400 when headcount is non-numeric", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, headcount: "abc" }
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Headcount must be a positive integer");
    });

    it("should return 400 when headcount is negative", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, headcount: -5 }
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Headcount must be a positive integer");
    });

    it("should return 400 when headcount is zero", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, headcount: 0 }
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Headcount must be a positive integer");
    });

    it("should return 400 when orderTotal is non-numeric", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, orderTotal: "not-a-number" }
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Order total must be a valid number");
    });

    it("should return 400 when orderTotal is negative", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, orderTotal: "-100" }
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Order total must be positive");
    });

    it("should return 400 when orderTotal is NaN string", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, orderTotal: "NaN" }
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Order total must be a valid number");
    });

    it("should return 400 when orderTotal is Infinity string", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, orderTotal: "Infinity" }
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Order total must be a valid number");
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

      // Admin notification dispatched with correct source
      expect(notifyOrderCreated).toHaveBeenCalledWith({
        orderId: mockCateringRequest.id,
        orderType: "catering",
        source: "customer_portal",
      });
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

    // --- B1: headcount Number() + Number.isInteger() ---

    it("should create with headcount 1000 when headcount is '1e3'", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, headcount: "1e3" }
      );

      const response = await POST(request);
      await expectSuccessResponse(response, 201);

      expect(mockPrisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            headcount: 1000,
          }),
        })
      );
    });

    it("should return 400 when headcount is '5.9' (not an integer)", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, headcount: "5.9" }
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Headcount must be a positive integer");
    });

    it("should return 400 when headcount is '12abc' (trailing garbage)", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, headcount: "12abc" }
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Headcount must be a positive integer");
    });

    // --- B3: headcount upper bound ---

    it("should return 400 when headcount exceeds INT4 ceiling", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, headcount: "2147483648" }
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Headcount is too large");
    });

    // --- B2: tip guard ---

    it("should return 400 when tip is 'abc' (not a 500)", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, tip: "abc" }
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Tip must be a valid number");
    });

    it("should return 400 when tip is negative", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, tip: "-5" }
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Tip cannot be negative");
    });

    it("should create with tip 0 when tip is '0'", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, tip: "0" }
      );

      const response = await POST(request);
      await expectSuccessResponse(response, 201);

      expect(mockPrisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tip: expect.objectContaining({ s: 1, e: 0 }), // Decimal(0)
          }),
        })
      );
    });

    it("should create with tip 0 when tip is omitted", async () => {
      const { tip, ...dataWithoutTip } = validCateringData as any;

      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        dataWithoutTip
      );

      const response = await POST(request);
      await expectSuccessResponse(response, 201);

      expect(mockPrisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tip: expect.objectContaining({ s: 1, e: 0 }), // Decimal(0)
          }),
        })
      );
    });

    // --- B3: orderTotal upper bound ---

    it("should return 400 when orderTotal is '1e99' (too large)", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/catering-requests",
        { ...validCateringData, orderTotal: "1e99" }
      );

      const response = await POST(request);
      const data = await expectValidationError(response);
      expect(data.message).toContain("Order total is too large");
    });
  });
});
