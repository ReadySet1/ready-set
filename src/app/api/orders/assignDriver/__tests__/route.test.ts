/**
 * Tests for /api/orders/assignDriver route
 *
 * This route is CRITICAL for dispatch operations - assigns drivers to orders.
 *
 * Tests cover:
 * - Authentication validation
 * - Required field validation (orderId, driverId, orderType)
 * - Driver soft-delete validation
 * - Order type handling (catering vs on_demand)
 * - Dispatch creation and update logic
 * - Order status updates
 * - Error handling
 */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { validateUserNotSoftDeleted } from "@/lib/soft-delete-handlers";
import {
  createPostRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectValidationError,
  expectForbidden,
  expectServerError,
} from "@/__tests__/helpers/api-test-helpers";

// Mock dependencies
jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/soft-delete-handlers", () => ({
  validateUserNotSoftDeleted: jest.fn(),
  getActiveDriversForDispatch: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockPrisma = prisma as any;
const mockValidateUserNotSoftDeleted = validateUserNotSoftDeleted as jest.MockedFunction<
  typeof validateUserNotSoftDeleted
>;

describe("/api/orders/assignDriver", () => {
  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
  };

  const mockDriver = {
    id: "driver-id",
    name: "Test Driver",
    email: "driver@example.com",
    contactNumber: "555-0100",
  };

  const mockCateringOrder = {
    id: "catering-order-id",
    orderNumber: "CAT001",
    status: "PENDING",
    userId: "client-user-id",
  };

  const mockOnDemandOrder = {
    id: "ondemand-order-id",
    orderNumber: "OND001",
    status: "PENDING",
    userId: "client-user-id",
  };

  const mockDispatch = {
    id: "dispatch-id",
    driverId: mockDriver.id,
    driver: mockDriver,
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

    // Default: driver is valid (not soft-deleted)
    mockValidateUserNotSoftDeleted.mockResolvedValue({
      isValid: true,
      user: mockDriver,
    });
  });

  describe("POST /api/orders/assignDriver", () => {
    describe("Authentication", () => {
      it("should return 401 when user is not authenticated", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
        } as any);

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockCateringOrder.id,
          driverId: mockDriver.id,
          orderType: "catering",
        });

        const response = await POST(request);
        await expectUnauthorized(response);
      });

      it("should return 401 when auth error occurs", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: null },
              error: { message: "Invalid token" },
            }),
          },
        } as any);

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockCateringOrder.id,
          driverId: mockDriver.id,
          orderType: "catering",
        });

        const response = await POST(request);
        await expectUnauthorized(response);
      });
    });

    describe("Input validation", () => {
      it("should return 400 when orderId is missing", async () => {
        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          driverId: mockDriver.id,
          orderType: "catering",
        });

        const response = await POST(request);
        await expectValidationError(response, /orderId/);
      });

      it("should return 400 when driverId is missing", async () => {
        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockCateringOrder.id,
          orderType: "catering",
        });

        const response = await POST(request);
        await expectValidationError(response, /driverId/);
      });

      it("should return 400 when orderType is missing", async () => {
        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockCateringOrder.id,
          driverId: mockDriver.id,
        });

        const response = await POST(request);
        await expectValidationError(response, /orderType/);
      });

      it("should return 400 when all required fields are missing", async () => {
        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {});

        const response = await POST(request);
        await expectValidationError(response);
      });
    });

    describe("Driver validation", () => {
      it("should return 403 when driver is soft-deleted", async () => {
        mockValidateUserNotSoftDeleted.mockResolvedValue({
          isValid: false,
          error: "User account has been deactivated",
        });

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockCateringOrder.id,
          driverId: mockDriver.id,
          orderType: "catering",
        });

        const response = await POST(request);
        await expectForbidden(response);
      });

      it("should validate driver using validateUserNotSoftDeleted", async () => {
        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            cateringRequest: {
              findUnique: jest.fn().mockResolvedValue(mockCateringOrder),
              update: jest.fn().mockResolvedValue({ ...mockCateringOrder, status: "ASSIGNED" }),
            },
            dispatch: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue(mockDispatch),
            },
          });
        });

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockCateringOrder.id,
          driverId: mockDriver.id,
          orderType: "catering",
        });

        await POST(request);

        expect(mockValidateUserNotSoftDeleted).toHaveBeenCalledWith(mockDriver.id);
      });
    });

    describe("Catering order assignment", () => {
      it("should create new dispatch for catering order without existing dispatch", async () => {
        const mockDispatchCreate = jest.fn().mockResolvedValue(mockDispatch);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            cateringRequest: {
              findUnique: jest.fn().mockResolvedValue(mockCateringOrder),
              update: jest.fn().mockResolvedValue({ ...mockCateringOrder, status: "ASSIGNED" }),
            },
            dispatch: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: mockDispatchCreate,
            },
          });
        });

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockCateringOrder.id,
          driverId: mockDriver.id,
          orderType: "catering",
        });

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(mockDispatchCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              driverId: mockDriver.id,
              cateringRequestId: mockCateringOrder.id,
            }),
          })
        );
      });

      it("should update existing dispatch for catering order", async () => {
        const existingDispatch = {
          id: "existing-dispatch-id",
          driverId: "old-driver-id",
        };
        const mockDispatchUpdate = jest.fn().mockResolvedValue({
          ...existingDispatch,
          driverId: mockDriver.id,
          driver: mockDriver,
        });

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            cateringRequest: {
              findUnique: jest.fn().mockResolvedValue(mockCateringOrder),
              update: jest.fn().mockResolvedValue({ ...mockCateringOrder, status: "ASSIGNED" }),
            },
            dispatch: {
              findFirst: jest.fn().mockResolvedValue(existingDispatch),
              update: mockDispatchUpdate,
            },
          });
        });

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockCateringOrder.id,
          driverId: mockDriver.id,
          orderType: "catering",
        });

        const response = await POST(request);
        await expectSuccessResponse(response, 200);

        expect(mockDispatchUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: existingDispatch.id },
            data: { driverId: mockDriver.id },
          })
        );
      });

      it("should update catering order status to ASSIGNED", async () => {
        const mockOrderUpdate = jest.fn().mockResolvedValue({
          ...mockCateringOrder,
          status: "ASSIGNED",
        });

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            cateringRequest: {
              findUnique: jest.fn().mockResolvedValue(mockCateringOrder),
              update: mockOrderUpdate,
            },
            dispatch: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue(mockDispatch),
            },
          });
        });

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockCateringOrder.id,
          driverId: mockDriver.id,
          orderType: "catering",
        });

        await POST(request);

        expect(mockOrderUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { status: "ASSIGNED" },
          })
        );
      });
    });

    describe("On-demand order assignment", () => {
      it("should create new dispatch for on_demand order", async () => {
        const mockDispatchCreate = jest.fn().mockResolvedValue(mockDispatch);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            onDemand: {
              findUnique: jest.fn().mockResolvedValue(mockOnDemandOrder),
              update: jest.fn().mockResolvedValue({ ...mockOnDemandOrder, status: "ASSIGNED" }),
            },
            dispatch: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: mockDispatchCreate,
            },
          });
        });

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockOnDemandOrder.id,
          driverId: mockDriver.id,
          orderType: "on_demand",
        });

        const response = await POST(request);
        await expectSuccessResponse(response, 200);

        expect(mockDispatchCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              driverId: mockDriver.id,
              onDemandId: mockOnDemandOrder.id,
            }),
          })
        );
      });

      it("should update on_demand order status to ASSIGNED", async () => {
        const mockOrderUpdate = jest.fn().mockResolvedValue({
          ...mockOnDemandOrder,
          status: "ASSIGNED",
        });

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            onDemand: {
              findUnique: jest.fn().mockResolvedValue(mockOnDemandOrder),
              update: mockOrderUpdate,
            },
            dispatch: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue(mockDispatch),
            },
          });
        });

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockOnDemandOrder.id,
          driverId: mockDriver.id,
          orderType: "on_demand",
        });

        await POST(request);

        expect(mockOrderUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { status: "ASSIGNED" },
          })
        );
      });
    });

    describe("Error handling", () => {
      it("should return 500 for invalid order type", async () => {
        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          return callback({});
        });

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockCateringOrder.id,
          driverId: mockDriver.id,
          orderType: "invalid_type",
        });

        const response = await POST(request);
        await expectServerError(response);
      });

      it("should return 500 when order is not found", async () => {
        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            cateringRequest: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
          });
        });

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: "non-existent-order",
          driverId: mockDriver.id,
          orderType: "catering",
        });

        const response = await POST(request);
        await expectServerError(response);
      });

      it("should return 500 when database transaction fails", async () => {
        mockPrisma.$transaction.mockRejectedValue(new Error("Transaction failed"));

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockCateringOrder.id,
          driverId: mockDriver.id,
          orderType: "catering",
        });

        const response = await POST(request);
        await expectServerError(response);
      });

      it("should handle Prisma errors with code", async () => {
        const prismaError = {
          code: "P2002",
          message: "Unique constraint violation",
          meta: { target: ["driverId"] },
        };
        mockPrisma.$transaction.mockRejectedValue(prismaError);

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockCateringOrder.id,
          driverId: mockDriver.id,
          orderType: "catering",
        });

        const response = await POST(request);
        await expectServerError(response);
      });
    });

    describe("Response structure", () => {
      it("should return dispatch and updated order in response", async () => {
        const updatedOrder = { ...mockCateringOrder, status: "ASSIGNED" };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            cateringRequest: {
              findUnique: jest.fn().mockResolvedValue(mockCateringOrder),
              update: jest.fn().mockResolvedValue(updatedOrder),
            },
            dispatch: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue(mockDispatch),
            },
          });
        });

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockCateringOrder.id,
          driverId: mockDriver.id,
          orderType: "catering",
        });

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveProperty("updatedOrder");
        expect(data).toHaveProperty("dispatch");
        expect(data.updatedOrder.status).toBe("ASSIGNED");
      });

      it("should include driver info in dispatch response", async () => {
        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            cateringRequest: {
              findUnique: jest.fn().mockResolvedValue(mockCateringOrder),
              update: jest.fn().mockResolvedValue({ ...mockCateringOrder, status: "ASSIGNED" }),
            },
            dispatch: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({
                ...mockDispatch,
                driver: {
                  id: mockDriver.id,
                  name: mockDriver.name,
                  email: mockDriver.email,
                  contactNumber: mockDriver.contactNumber,
                },
              }),
            },
          });
        });

        const request = createPostRequest("http://localhost:3000/api/orders/assignDriver", {
          orderId: mockCateringOrder.id,
          driverId: mockDriver.id,
          orderType: "catering",
        });

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.dispatch).toHaveProperty("driver");
        expect(data.dispatch.driver.name).toBe(mockDriver.name);
      });
    });
  });
});
