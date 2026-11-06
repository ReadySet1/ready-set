/**
 * Tests for /api/orders route
 *
 * This route is REVENUE CRITICAL as it handles order management for both:
 * - Catering orders
 * - On-demand orders
 *
 * Tests cover:
 * - GET: Fetching orders with auth, filtering, sorting, pagination
 * - POST: Creating orders with validation and notifications
 * - Authentication enforcement
 * - Multi-tenant data isolation
 * - Error handling
 */

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { validateApiAuth } from "@/utils/api-auth";
import { prisma } from "@/utils/prismaDB";
import { sendDeliveryNotifications } from "@/services/notifications/delivery-notifications";
import { invalidateVendorCacheOnOrderCreate } from "@/lib/cache/cache-invalidation";
import {
  createPostRequest,
  createRequestWithParams,
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectValidationError,
  expectServerError,
  createMockCateringOrder,
  createMockOnDemandOrder,
} from "@/__tests__/helpers/api-test-helpers";

// Mock dependencies
jest.mock("@/utils/api-auth", () => ({
  validateApiAuth: jest.fn(),
}));

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    cateringRequest: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    onDemand: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/services/notifications/delivery-notifications", () => ({
  sendDeliveryNotifications: jest.fn(),
}));

jest.mock("@/lib/cache/cache-invalidation", () => ({
  invalidateVendorCacheOnOrderCreate: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue({}),
}));

const mockValidateApiAuth = validateApiAuth as jest.MockedFunction<typeof validateApiAuth>;
const mockPrisma = prisma as any;
const mockSendNotifications = sendDeliveryNotifications as jest.MockedFunction<typeof sendDeliveryNotifications>;
const mockInvalidateCache = invalidateVendorCacheOnOrderCreate as jest.MockedFunction<typeof invalidateVendorCacheOnOrderCreate>;

describe("/api/orders", () => {
  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
    type: "CLIENT",
  };

  const mockCateringOrder = createMockCateringOrder({
    id: "catering-1",
    orderNumber: "CAT001",
    userId: mockUser.id,
    user: {
      name: "Test User",
      email: mockUser.email,
    },
  });

  const mockOnDemandOrder = createMockOnDemandOrder({
    id: "ondemand-1",
    orderNumber: "OND001",
    userId: mockUser.id,
    user: {
      name: "Test User",
      email: mockUser.email,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated user
    mockValidateApiAuth.mockResolvedValue({
      isValid: true,
      user: mockUser,
    });

    // Default: empty orders
    mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
    mockPrisma.onDemand.findMany.mockResolvedValue([]);

    // Default: successful notifications
    mockSendNotifications.mockResolvedValue(undefined);
    mockInvalidateCache.mockReturnValue(undefined);
  });

  describe("GET /api/orders", () => {
    it("should return 401 when not authenticated", async () => {
      mockValidateApiAuth.mockResolvedValue({
        isValid: false,
        user: null,
      });

      const request = createGetRequest("http://localhost:3000/api/orders");
      const response = await GET(request);

      await expectUnauthorized(response, "Authentication required");
    });

    it("should fetch both catering and on-demand orders", async () => {
      mockPrisma.cateringRequest.findMany.mockResolvedValue([mockCateringOrder]);
      mockPrisma.onDemand.findMany.mockResolvedValue([mockOnDemandOrder]);

      const request = createGetRequest("http://localhost:3000/api/orders");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      expect(data.orders).toHaveLength(2);
      expect(data.orders.some((o: any) => o.type === 'catering')).toBe(true);
      expect(data.orders.some((o: any) => o.type === 'ondemand')).toBe(true);
    });

    it("should apply pagination (take and skip)", async () => {
      const orders = Array.from({ length: 20 }, (_, i) => ({
        ...mockCateringOrder,
        id: `order-${i}`,
        orderNumber: `CAT${String(i).padStart(3, '0')}`,
      }));

      mockPrisma.cateringRequest.findMany.mockResolvedValue(orders);

      const request = createRequestWithParams("http://localhost:3000/api/orders", {
        take: "10",
        skip: "5",
      });

      const response = await GET(request);

      // Verify Prisma was called with correct pagination
      expect(mockPrisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        })
      );
    });

    it("should filter by status", async () => {
      const request = createRequestWithParams("http://localhost:3000/api/orders", {
        status: "ACTIVE",
      });

      await GET(request);

      // Verify status filter was applied
      expect(mockPrisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "ACTIVE",
          }),
        })
      );
    });

    it("should search by order number and client name/email", async () => {
      const request = createRequestWithParams("http://localhost:3000/api/orders", {
        search: "test",
      });

      await GET(request);

      // Verify search filter was applied
      expect(mockPrisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                orderNumber: expect.objectContaining({ contains: "test" }),
              }),
            ]),
          }),
        })
      );
    });

    it("should sort by specified field and order", async () => {
      const request = createRequestWithParams("http://localhost:3000/api/orders", {
        sortBy: "createdAt",
        sortOrder: "asc",
      });

      await GET(request);

      // Verify sorting was applied
      expect(mockPrisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: "asc",
          },
        })
      );
    });

    it("should default to sorting by createdAt desc", async () => {
      const request = createGetRequest("http://localhost:3000/api/orders");

      await GET(request);

      // Verify default sorting
      expect(mockPrisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: "desc",
          },
        })
      );
    });

    it("should include related data (dispatches, user, addresses, files)", async () => {
      const request = createGetRequest("http://localhost:3000/api/orders");

      await GET(request);

      // Verify includes were applied
      expect(mockPrisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            dispatches: expect.any(Object),
            user: expect.any(Object),
            pickupAddress: true,
            deliveryAddress: true,
            fileUploads: true,
          }),
        })
      );
    });

    it("should transform order data correctly", async () => {
      mockPrisma.cateringRequest.findMany.mockResolvedValue([mockCateringOrder]);

      const request = createGetRequest("http://localhost:3000/api/orders");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      expect(data.orders[0]).toMatchObject({
        id: mockCateringOrder.id,
        type: 'catering',
        orderNumber: mockCateringOrder.orderNumber,
        status: mockCateringOrder.status,
      });
    });

    it("should return pagination metadata", async () => {
      const orders = Array.from({ length: 15 }, (_, i) => ({
        ...mockCateringOrder,
        id: `order-${i}`,
      }));

      mockPrisma.cateringRequest.findMany.mockResolvedValue(orders);

      const request = createRequestWithParams("http://localhost:3000/api/orders", {
        take: "10",
      });

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data).toHaveProperty("totalCount");
      expect(data).toHaveProperty("hasMore");
      expect(data.totalCount).toBe(15);
      expect(data.hasMore).toBe(true);
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.cateringRequest.findMany.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createGetRequest("http://localhost:3000/api/orders");
      const response = await GET(request);

      await expectServerError(response);
    });
  });

  describe("POST /api/orders", () => {
    const PICKUP_ADDRESS_ID = "11111111-1111-4111-8111-111111111111";
    const DELIVERY_ADDRESS_ID = "22222222-2222-4222-8222-222222222222";

    const validCateringOrderData = {
      type: "catering",
      pickupAddressId: PICKUP_ADDRESS_ID,
      deliveryAddressId: DELIVERY_ADDRESS_ID,
      headcount: 50,
      hoursNeeded: 2,
      specialNotes: "Test notes",
    };

    const validOnDemandOrderData = {
      type: "ondemand",
      pickupAddressId: PICKUP_ADDRESS_ID,
      deliveryAddressId: DELIVERY_ADDRESS_ID,
      pickupDateTime: "2026-11-10T17:00:00.000Z",
      arrivalDateTime: "2026-11-10T18:00:00.000Z",
      clientAttention: "Front desk",
      itemDelivered: "Documents",
      vehicleType: "CAR",
    };

    it("should return 401 when not authenticated", async () => {
      mockValidateApiAuth.mockResolvedValue({
        isValid: false,
        user: null,
      });

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        validCateringOrderData
      );

      const response = await POST(request);
      await expectUnauthorized(response, "Authentication required");
    });

    it("should require type field", async () => {
      const { type, ...dataWithoutType } = validCateringOrderData;

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        dataWithoutType
      );

      const response = await POST(request);
      await expectValidationError(response);
    });

    it("should require pickupAddressId field", async () => {
      const { pickupAddressId, ...dataWithoutPickup } = validCateringOrderData;

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        dataWithoutPickup
      );

      const response = await POST(request);
      await expectValidationError(response);
    });

    it("should require deliveryAddressId field", async () => {
      const { deliveryAddressId, ...dataWithoutDelivery } = validCateringOrderData;

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        dataWithoutDelivery
      );

      const response = await POST(request);
      await expectValidationError(response);
    });

    it("should create a catering order successfully", async () => {
      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          cateringRequest: {
            create: jest.fn().mockResolvedValue(mockCateringOrder),
          },
        });
      });

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        validCateringOrderData
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.success).toBe(true);
      expect(data.type).toBe('catering');
      expect(data.message).toContain("Order created successfully");
    });

    it("should create an on-demand order successfully", async () => {
      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          onDemand: {
            create: jest.fn().mockResolvedValue(mockOnDemandOrder),
          },
        });
      });

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        validOnDemandOrderData
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.success).toBe(true);
      expect(data.type).toBe('ondemand');
    });

    it("should generate order number for new orders", async () => {
      const createdOrder = { ...mockCateringOrder };

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          cateringRequest: {
            create: jest.fn().mockImplementation((data: any) => {
              expect(data.data.orderNumber).toBeDefined();
              expect(typeof data.data.orderNumber).toBe('string');
              return Promise.resolve(createdOrder);
            }),
          },
        });
      });

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        validCateringOrderData
      );

      await POST(request);
    });

    it("should set userId from authenticated user", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          cateringRequest: {
            create: jest.fn().mockImplementation((data: any) => {
              expect(data.data.userId).toBe(mockUser.id);
              return Promise.resolve(mockCateringOrder);
            }),
          },
        });
      });

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        validCateringOrderData
      );

      await POST(request);
    });

    it("should set status to PENDING for new orders", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          cateringRequest: {
            create: jest.fn().mockImplementation((data: any) => {
              expect(data.data.status).toBe('PENDING');
              return Promise.resolve(mockCateringOrder);
            }),
          },
        });
      });

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        validCateringOrderData
      );

      await POST(request);
    });

    it("should send delivery notifications after order creation", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          cateringRequest: {
            create: jest.fn().mockResolvedValue(mockCateringOrder),
          },
        });
      });

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        validCateringOrderData
      );

      await POST(request);

      // Verify notifications were sent
      expect(mockSendNotifications).toHaveBeenCalledWith({
        orderId: mockCateringOrder.id,
        customerEmail: mockCateringOrder.user.email,
      });
    });

    it("should invalidate vendor cache after order creation", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          cateringRequest: {
            create: jest.fn().mockResolvedValue(mockCateringOrder),
          },
        });
      });

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        validCateringOrderData
      );

      await POST(request);

      // Verify cache was invalidated
      expect(mockInvalidateCache).toHaveBeenCalledWith(
        mockUser.id,
        mockCateringOrder.id
      );
    });

    it("should not fail if notifications fail", async () => {
      mockSendNotifications.mockRejectedValue(new Error("Email service down"));

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          cateringRequest: {
            create: jest.fn().mockResolvedValue(mockCateringOrder),
          },
        });
      });

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        validCateringOrderData
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.success).toBe(true);
    });

    it("should reject invalid order type with 400 before touching the DB", async () => {
      const invalidData = {
        ...validCateringOrderData,
        type: "invalid",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        invalidData
      );

      const response = await POST(request);
      await expectValidationError(response);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("should handle database transaction errors", async () => {
      mockPrisma.$transaction.mockRejectedValue(
        new Error("Transaction failed")
      );

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        validCateringOrderData
      );

      const response = await POST(request);
      await expectServerError(response);
    });

    it("should handle Prisma unique constraint violations", async () => {
      mockPrisma.$transaction.mockRejectedValue({
        code: "P2002",
        message: "Unique constraint failed on orderNumber",
      });

      const request = createPostRequest(
        "http://localhost:3000/api/orders",
        validCateringOrderData
      );

      const response = await POST(request);
      await expectServerError(response);
    });
  });
  describe("POST /api/orders — mass assignment allowlist", () => {
    const PICKUP_ADDRESS_ID = "11111111-1111-4111-8111-111111111111";
    const DELIVERY_ADDRESS_ID = "22222222-2222-4222-8222-222222222222";

    const minimalCatering = {
      type: "catering",
      pickupAddressId: PICKUP_ADDRESS_ID,
      deliveryAddressId: DELIVERY_ADDRESS_ID,
    };

    const minimalOnDemand = {
      type: "ondemand",
      pickupAddressId: PICKUP_ADDRESS_ID,
      deliveryAddressId: DELIVERY_ADDRESS_ID,
      pickupDateTime: "2026-11-10T17:00:00.000Z",
      arrivalDateTime: "2026-11-10T18:00:00.000Z",
      clientAttention: "Front desk",
    };

    function captureCreate(model: "cateringRequest" | "onDemand", order: any) {
      const create = jest.fn().mockResolvedValue(order);
      mockPrisma.$transaction.mockImplementation(async (callback: any) =>
        callback({ [model]: { create } }),
      );
      return create;
    }

    function asRole(type: string) {
      mockValidateApiAuth.mockResolvedValue({
        isValid: true,
        user: { ...mockUser, type },
        userType: type as any,
      });
    }

    const post = (body: unknown) =>
      POST(createPostRequest("http://localhost:3000/api/orders", body));

    // Every column/relation the caller must never control on create.
    const serverOwnedFields: Array<[string, unknown]> = [
      ["id", "33333333-3333-4333-8333-333333333333"],
      ["guid", "forged-guid"],
      ["userId", "44444444-4444-4444-8444-444444444444"],
      ["orderNumber", "FORGED-001"],
      ["status", "COMPLETED"],
      ["driverStatus", "COMPLETED"],
      ["deliveryCost", 0.01],
      ["appliedDiscount", 999],
      ["pricingTierId", "55555555-5555-4555-8555-555555555555"],
      ["deliveryDistance", 0],
      ["ezCaterDeliveryId", "ezc-forged"],
      ["image", "https://evil.test/x.png"],
      ["createdAt", "2020-01-01T00:00:00.000Z"],
      ["updatedAt", "2020-01-01T00:00:00.000Z"],
      ["deletedAt", "2020-01-01T00:00:00.000Z"],
      ["deletedBy", "44444444-4444-4444-8444-444444444444"],
      ["deletionReason", "forged"],
      ["archivedAt", "2020-01-01T00:00:00.000Z"],
      ["archiveBatchId", "55555555-5555-4555-8555-555555555555"],
      ["dispatches", { create: { driverId: "66666666-6666-4666-8666-666666666666" } }],
      ["fileUploads", { create: { fileName: "x", fileUrl: "x" } }],
      ["statusHistory", { create: { status: "COMPLETED" } }],
      ["user", { connect: { id: "44444444-4444-4444-8444-444444444444" } }],
      ["pickupAddress", { create: { street1: "x" } }],
    ];

    it.each(serverOwnedFields)(
      "rejects server-owned field %s on a catering order (400, nothing created)",
      async (field, value) => {
        const create = captureCreate("cateringRequest", mockCateringOrder);

        const response = await post({ ...minimalCatering, [field]: value });

        const data = await expectValidationError(response);
        expect(JSON.stringify(data)).toContain(field);
        expect(create).not.toHaveBeenCalled();
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it.each(serverOwnedFields)(
      "rejects server-owned field %s on an on-demand order (400, nothing created)",
      async (field, value) => {
        const create = captureCreate("onDemand", mockOnDemandOrder);

        const response = await post({ ...minimalOnDemand, [field]: value });

        await expectValidationError(response);
        expect(create).not.toHaveBeenCalled();
      },
    );

    it("rejects catering-only fields on an on-demand order", async () => {
      captureCreate("onDemand", mockOnDemandOrder);

      const response = await post({ ...minimalOnDemand, headcount: 10 });

      await expectValidationError(response);
    });

    it("creates a catering order from a minimal body with only server-owned extras", async () => {
      const create = captureCreate("cateringRequest", mockCateringOrder);

      const response = await post(minimalCatering);
      await expectSuccessResponse(response, 200);

      const data = create.mock.calls[0][0].data;
      expect(Object.keys(data).sort()).toEqual(
        [
          "createdAt",
          "deliveryAddressId",
          "orderNumber",
          "pickupAddressId",
          "status",
          "updatedAt",
          "userId",
        ].sort(),
      );
      expect(data.userId).toBe(mockUser.id);
      expect(data.status).toBe("PENDING");
    });

    it("creates an on-demand order from a minimal body, parsing ISO datetimes", async () => {
      const create = captureCreate("onDemand", mockOnDemandOrder);

      const response = await post(minimalOnDemand);
      await expectSuccessResponse(response, 200);

      const data = create.mock.calls[0][0].data;
      expect(data.pickupDateTime).toEqual(new Date("2026-11-10T17:00:00.000Z"));
      expect(data.arrivalDateTime).toEqual(new Date("2026-11-10T18:00:00.000Z"));
      expect(data.clientAttention).toBe("Front desk");
      expect(data.userId).toBe(mockUser.id);
      expect(data).not.toHaveProperty("type");
    });

    it("passes through client-entered catering fields, including orderTotal and tip", async () => {
      const create = captureCreate("cateringRequest", mockCateringOrder);

      const response = await post({
        ...minimalCatering,
        brokerage: "Direct",
        headcount: 25,
        needHost: "YES",
        hoursNeeded: 3,
        numberOfHosts: 2,
        clientAttention: "Jane",
        pickupNotes: "Back door",
        specialNotes: "Nut-free",
        orderTotal: 450.5,
        tip: 20,
        pickupDateTime: "2026-11-10T17:00:00.000Z",
      });
      await expectSuccessResponse(response, 200);

      expect(create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({
          brokerage: "Direct",
          headcount: 25,
          needHost: "YES",
          orderTotal: 450.5,
          tip: 20,
          pickupDateTime: new Date("2026-11-10T17:00:00.000Z"),
        }),
      );
    });

    it.each<[string, Record<string, unknown>]>([
      ["negative orderTotal", { orderTotal: -10 }],
      ["zero orderTotal", { orderTotal: 0 }],
      ["orderTotal over Decimal(10,2)", { orderTotal: 100000000 }],
      ["negative tip", { tip: -1 }],
      ["string orderTotal", { orderTotal: "450" }],
      ["non-integer headcount", { headcount: 2.5 }],
      ["non-uuid pickupAddressId", { pickupAddressId: "not-a-uuid" }],
      ["object pickupAddressId", { pickupAddressId: { connect: { id: "x" } } }],
      ["unparseable date", { pickupDateTime: "tomorrow" }],
      ["unknown needHost", { needHost: "MAYBE" }],
    ])("rejects %s", async (_label, patch) => {
      const create = captureCreate("cateringRequest", mockCateringOrder);

      const response = await post({ ...minimalCatering, ...patch });

      await expectValidationError(response);
      expect(create).not.toHaveBeenCalled();
    });

    it("requires the on-demand NOT NULL columns", async () => {
      const { clientAttention, ...withoutAttention } = minimalOnDemand;
      captureCreate("onDemand", mockOnDemandOrder);

      const response = await post(withoutAttention);

      await expectValidationError(response);
    });

    it("rejects a non-object body", async () => {
      const response = await post(["type", "catering"]);
      await expectValidationError(response);
    });

    it("forbids DRIVER accounts from creating orders", async () => {
      asRole("DRIVER");
      const create = captureCreate("cateringRequest", mockCateringOrder);

      const response = await post(minimalCatering);

      expect(response.status).toBe(403);
      expect(create).not.toHaveBeenCalled();
    });

    it.each(["CLIENT", "VENDOR", "ADMIN", "SUPER_ADMIN", "HELPDESK"])(
      "lets %s create an order",
      async (role) => {
        asRole(role);
        captureCreate("cateringRequest", mockCateringOrder);

        const response = await post(minimalCatering);

        await expectSuccessResponse(response, 200);
      },
    );

    it("applies the same allowlist to admins: pricing columns are not settable here", async () => {
      asRole("ADMIN");
      const create = captureCreate("cateringRequest", mockCateringOrder);

      const response = await post({ ...minimalCatering, deliveryCost: 5, appliedDiscount: 10 });

      await expectValidationError(response);
      expect(create).not.toHaveBeenCalled();
    });

    it("never lets an admin create an order on behalf of another user", async () => {
      asRole("SUPER_ADMIN");
      captureCreate("cateringRequest", mockCateringOrder);

      const response = await post({
        ...minimalCatering,
        userId: "44444444-4444-4444-8444-444444444444",
      });

      await expectValidationError(response);
    });
  });
});
