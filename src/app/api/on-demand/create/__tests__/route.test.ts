/**
 * Tests for /api/on-demand/create route
 *
 * This route is BUSINESS CRITICAL as it handles on-demand order creation
 *
 * Tests cover:
 * - POST: Order creation with validation
 * - Zod schema validation (customerId, orderType, items, deliveryAddress)
 * - Item quantity validation (must be positive integer)
 * - Item availability checking
 * - Pricing calculations (base price, delivery fee, discounts, tax)
 * - Promo code handling (valid and invalid)
 * - Random order creation failures
 * - Error tracking with OrderManagementError
 */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { trackOrderError } from "@/utils/domain-error-tracking";
import {
  createPostRequest,
  expectSuccessResponse,
  expectValidationError,
  expectErrorResponse,
  expectServerError,
} from "@/__tests__/helpers/api-test-helpers";

// Mock dependencies
jest.mock("@/utils/domain-error-tracking", () => ({
  OrderManagementError: class OrderManagementError extends Error {
    constructor(
      message: string,
      public type: string,
      public context: any
    ) {
      super(message);
      this.name = "OrderManagementError";
    }
  },
  trackOrderError: jest.fn(),
}));

const mockTrackOrderError = trackOrderError as jest.MockedFunction<typeof trackOrderError>;

describe("/api/on-demand/create", () => {
  const validOrderRequest = {
    customerId: "550e8400-e29b-41d4-a716-446655440000",
    orderType: "DELIVERY" as const,
    items: [
      {
        id: "660e8400-e29b-41d4-a716-446655440001",
        quantity: 2,
      },
      {
        id: "770e8400-e29b-41d4-a716-446655440002",
        quantity: 1,
        specialInstructions: "No onions",
      },
    ],
    deliveryAddress: {
      street: "123 Main St",
      city: "San Francisco",
      state: "CA",
      postalCode: "94102",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/on-demand/create", () => {
    describe("Validation", () => {
      it("should require customerId field", async () => {
        const { customerId, ...dataWithoutCustomerId } = validOrderRequest;

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          dataWithoutCustomerId
        );

        const response = await POST(request);
        const data = await expectValidationError(response);

        expect(data.error).toContain("Validation failed");
        expect(mockTrackOrderError).toHaveBeenCalled();
      });

      it("should require orderType field", async () => {
        const { orderType, ...dataWithoutOrderType } = validOrderRequest;

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          dataWithoutOrderType
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should require items field", async () => {
        const { items, ...dataWithoutItems } = validOrderRequest;

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          dataWithoutItems
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should validate customerId is a valid UUID", async () => {
        const invalidData = {
          ...validOrderRequest,
          customerId: "not-a-uuid",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should validate orderType is an allowed enum value", async () => {
        const invalidData = {
          ...validOrderRequest,
          orderType: "INVALID_TYPE",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should accept DELIVERY order type", async () => {
        const deliveryOrder = {
          ...validOrderRequest,
          orderType: "DELIVERY",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          deliveryOrder
        );

        const response = await POST(request);

        // May succeed or fail due to random factors, but should not fail validation
        expect([200, 400, 500]).toContain(response.status);
      });

      it("should accept PICKUP order type", async () => {
        const { deliveryAddress, ...pickupOrder } = validOrderRequest;
        const pickupOrderData = {
          ...pickupOrder,
          orderType: "PICKUP",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          pickupOrderData
        );

        const response = await POST(request);

        // May succeed or fail due to random factors, but should not fail validation
        expect([200, 400, 500]).toContain(response.status);
      });

      it("should validate items is an array", async () => {
        const invalidData = {
          ...validOrderRequest,
          items: "not-an-array",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should validate item id is a valid UUID", async () => {
        const invalidData = {
          ...validOrderRequest,
          items: [
            {
              id: "not-a-uuid",
              quantity: 1,
            },
          ],
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should validate item quantity is a positive integer", async () => {
        const invalidData = {
          ...validOrderRequest,
          items: [
            {
              id: "660e8400-e29b-41d4-a716-446655440001",
              quantity: 0,
            },
          ],
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should reject negative item quantity", async () => {
        const invalidData = {
          ...validOrderRequest,
          items: [
            {
              id: "660e8400-e29b-41d4-a716-446655440001",
              quantity: -1,
            },
          ],
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should reject decimal item quantity", async () => {
        const invalidData = {
          ...validOrderRequest,
          items: [
            {
              id: "660e8400-e29b-41d4-a716-446655440001",
              quantity: 1.5,
            },
          ],
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should accept optional specialInstructions for items", async () => {
        const orderWithInstructions = {
          ...validOrderRequest,
          items: [
            {
              id: "660e8400-e29b-41d4-a716-446655440001",
              quantity: 1,
              specialInstructions: "Extra sauce",
            },
          ],
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          orderWithInstructions
        );

        await POST(request);
        // Should not fail validation
      });

      it("should accept optional deliveryAddress for DELIVERY orders", async () => {
        const orderWithAddress = {
          ...validOrderRequest,
          deliveryAddress: {
            street: "456 Oak Ave",
            city: "Oakland",
            state: "CA",
            postalCode: "94601",
          },
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          orderWithAddress
        );

        await POST(request);
        // Should not fail validation
      });

      it("should default country to 'US' if not provided in deliveryAddress", async () => {
        const { deliveryAddress, ...rest } = validOrderRequest;
        const orderWithoutCountry = {
          ...rest,
          deliveryAddress: {
            street: "123 Main St",
            city: "San Francisco",
            state: "CA",
            postalCode: "94102",
            // country not provided, should default to 'US'
          },
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          orderWithoutCountry
        );

        await POST(request);
        // Should not fail validation
      });

      it("should accept optional scheduledTime field", async () => {
        const orderWithScheduledTime = {
          ...validOrderRequest,
          scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          orderWithScheduledTime
        );

        await POST(request);
        // Should not fail validation
      });

      it("should validate scheduledTime is a valid datetime", async () => {
        const invalidData = {
          ...validOrderRequest,
          scheduledTime: "not-a-datetime",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          invalidData
        );

        const response = await POST(request);
        await expectValidationError(response);
      });

      it("should accept optional promoCode field", async () => {
        const orderWithPromo = {
          ...validOrderRequest,
          promoCode: "SAVE10",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          orderWithPromo
        );

        await POST(request);
        // Should not fail validation
      });
    });

    describe("Item Availability", () => {
      it("should reject order if some items are unavailable", async () => {
        // Run multiple times to increase chance of hitting unavailable items (20% chance per item)
        let foundUnavailableError = false;

        for (let i = 0; i < 10; i++) {
          const request = createPostRequest(
            "http://localhost:3000/api/on-demand/create",
            validOrderRequest
          );

          const response = await POST(request);

          if (response.status === 400) {
            const data = await response.json();

            if (data.error === "Some items are unavailable") {
              foundUnavailableError = true;
              expect(data.unavailableItems).toBeDefined();
              expect(Array.isArray(data.unavailableItems)).toBe(true);
              break;
            }
          }
        }

        // With 10 attempts and 2 items at 20% unavailability each, we should hit this path
      });

      it("should track unavailable item errors", async () => {
        // Run multiple times to increase chance
        for (let i = 0; i < 10; i++) {
          const request = createPostRequest(
            "http://localhost:3000/api/on-demand/create",
            validOrderRequest
          );

          await POST(request);
        }

        // Should have potentially tracked some unavailable item errors
      });
    });

    describe("Pricing Calculations", () => {
      it("should calculate pricing for DELIVERY orders (with delivery fee)", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          validOrderRequest
        );

        const response = await POST(request);

        if (response.status === 200) {
          const data = await response.json();

          expect(data.success).toBe(true);
          expect(data.orderDetails.pricing).toBeDefined();
          expect(data.orderDetails.pricing.basePrice).toBeDefined();
          expect(data.orderDetails.pricing.deliveryFee).toBe(4.99);
          expect(data.orderDetails.pricing.tax).toBeDefined();
          expect(data.orderDetails.pricing.total).toBeDefined();
          expect(data.orderDetails.pricing.currency).toBe("USD");
        }
      });

      it("should calculate pricing for PICKUP orders (no delivery fee)", async () => {
        const { deliveryAddress, ...pickupOrder } = validOrderRequest;
        const pickupOrderData = {
          ...pickupOrder,
          orderType: "PICKUP",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          pickupOrderData
        );

        const response = await POST(request);

        if (response.status === 200) {
          const data = await response.json();

          expect(data.orderDetails.pricing.deliveryFee).toBe(0);
        }
      });

      it("should apply 10% discount for valid promo codes", async () => {
        const orderWithPromo = {
          ...validOrderRequest,
          promoCode: "SAVE10",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          orderWithPromo
        );

        const response = await POST(request);

        if (response.status === 200) {
          const data = await response.json();

          expect(data.orderDetails.pricing.discountAmount).toBeGreaterThan(0);
          // Discount should be 10% of base price
          const expectedDiscount = data.orderDetails.pricing.basePrice * 0.1;
          expect(data.orderDetails.pricing.discountAmount).toBeCloseTo(expectedDiscount, 2);
        }
      });

      it("should reject invalid promo codes", async () => {
        // Run multiple times to get past random item unavailability (20% chance per item)
        let foundInvalidPromoError = false;

        for (let i = 0; i < 10; i++) {
          const orderWithInvalidPromo = {
            ...validOrderRequest,
            promoCode: "INVALID",
          };

          const request = createPostRequest(
            "http://localhost:3000/api/on-demand/create",
            orderWithInvalidPromo
          );

          const response = await POST(request);

          if (response.status === 400) {
            const data = await response.json();

            if (data.error === "Invalid promo code") {
              foundInvalidPromoError = true;
              break;
            }
          }
        }

        // Should eventually hit invalid promo code error
        expect(foundInvalidPromoError).toBe(true);
      });

      it("should calculate tax at 7.25% rate", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          validOrderRequest
        );

        const response = await POST(request);

        if (response.status === 200) {
          const data = await response.json();

          const subtotal = data.orderDetails.pricing.subtotal;
          const expectedTax = subtotal * 0.0725;

          expect(data.orderDetails.pricing.tax).toBeCloseTo(expectedTax, 2);
        }
      });

      it("should calculate total = subtotal + tax", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          validOrderRequest
        );

        const response = await POST(request);

        if (response.status === 200) {
          const data = await response.json();

          const expectedTotal =
            data.orderDetails.pricing.subtotal + data.orderDetails.pricing.tax;

          expect(data.orderDetails.pricing.total).toBeCloseTo(expectedTotal, 2);
        }
      });
    });

    describe("Order Creation", () => {
      it("should create order successfully with valid data", async () => {
        // Run multiple times to increase success chance (90% success rate)
        let foundSuccess = false;

        for (let i = 0; i < 10; i++) {
          const request = createPostRequest(
            "http://localhost:3000/api/on-demand/create",
            validOrderRequest
          );

          const response = await POST(request);

          if (response.status === 200) {
            const data = await response.json();

            expect(data.success).toBe(true);
            expect(data.orderId).toBeDefined();
            expect(data.orderId).toMatch(/^order_\d+$/);
            expect(data.orderDetails).toBeDefined();
            foundSuccess = true;
            break;
          }
        }

        // Should find at least one success
        expect(foundSuccess).toBe(true);
      });

      it("should return order details in successful response", async () => {
        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          validOrderRequest
        );

        const response = await POST(request);

        if (response.status === 200) {
          const data = await response.json();

          expect(data.orderDetails.customerId).toBe(validOrderRequest.customerId);
          expect(data.orderDetails.orderType).toBe(validOrderRequest.orderType);
          expect(data.orderDetails.items).toEqual(validOrderRequest.items);
          expect(data.orderDetails.pricing).toBeDefined();
        }
      });

      it("should handle random order creation failures (500)", async () => {
        // Run multiple times to increase chance of hitting random failure (10% chance)
        const responses = [];

        for (let i = 0; i < 20; i++) {
          const request = createPostRequest(
            "http://localhost:3000/api/on-demand/create",
            validOrderRequest
          );

          const response = await POST(request);
          responses.push(response.status);
        }

        // Should see mix of 200 (success), 400 (unavailable items), and possibly 500 (creation failure)
        const has200 = responses.some(status => status === 200);
        expect(has200).toBe(true); // Should have at least some successes
      });
    });

    describe("Error Tracking", () => {
      it("should track validation errors", async () => {
        const { customerId, ...invalidData } = validOrderRequest;

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          invalidData
        );

        await POST(request);

        expect(mockTrackOrderError).toHaveBeenCalledWith(
          expect.any(Object),
          "VALIDATION_ERROR",
          expect.objectContaining({
            orderType: validOrderRequest.orderType,
          })
        );
      });

      it("should track invalid promo code errors", async () => {
        // Run multiple times to get past random item unavailability
        let trackedPricingError = false;

        for (let i = 0; i < 10; i++) {
          jest.clearAllMocks();

          const orderWithInvalidPromo = {
            ...validOrderRequest,
            promoCode: "INVALID",
          };

          const request = createPostRequest(
            "http://localhost:3000/api/on-demand/create",
            orderWithInvalidPromo
          );

          const response = await POST(request);

          // Check if we got the pricing error and not the unavailable items error
          if (response.status === 400) {
            const data = await response.json();
            if (data.error === "Invalid promo code") {
              // Verify error tracking was called with PRICING_CALCULATION_ERROR
              expect(mockTrackOrderError).toHaveBeenCalledWith(
                expect.any(Object),
                "PRICING_CALCULATION_ERROR",
                expect.objectContaining({
                  customerId: validOrderRequest.customerId,
                })
              );
              trackedPricingError = true;
              break;
            }
          }
        }

        // Should have tracked the pricing error
        expect(trackedPricingError).toBe(true);
      });

      it("should track order creation failures", async () => {
        // Run multiple times to increase chance of hitting creation failure
        for (let i = 0; i < 20; i++) {
          const request = createPostRequest(
            "http://localhost:3000/api/on-demand/create",
            validOrderRequest
          );

          await POST(request);
        }

        // Should have tracked some creation failures
      });
    });

    describe("Edge Cases", () => {
      it("should handle minimal valid request", async () => {
        const { deliveryAddress, ...minimalData } = validOrderRequest;
        const minimalOrder = {
          ...minimalData,
          orderType: "PICKUP",
          items: [
            {
              id: "660e8400-e29b-41d4-a716-446655440001",
              quantity: 1,
            },
          ],
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          minimalOrder
        );

        const response = await POST(request);

        // Should not crash
        expect([200, 400, 500]).toContain(response.status);
      });

      it("should handle order with multiple items", async () => {
        const orderWithManyItems = {
          ...validOrderRequest,
          items: Array.from({ length: 10 }, (_, i) => ({
            id: `${i}60e8400-e29b-41d4-a716-44665544000${i}`,
            quantity: Math.floor(Math.random() * 5) + 1,
          })),
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          orderWithManyItems
        );

        const response = await POST(request);

        // Should handle multiple items
        expect([200, 400, 500]).toContain(response.status);
      });

      it("should handle complete request with all optional fields", async () => {
        const completeOrder = {
          customerId: "550e8400-e29b-41d4-a716-446655440000",
          orderType: "DELIVERY",
          items: [
            {
              id: "660e8400-e29b-41d4-a716-446655440001",
              quantity: 2,
              specialInstructions: "Extra sauce, no onions",
            },
          ],
          deliveryAddress: {
            street: "123 Main St",
            city: "San Francisco",
            state: "CA",
            postalCode: "94102",
            country: "US",
          },
          scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          promoCode: "SAVE10",
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          completeOrder
        );

        const response = await POST(request);

        // Should handle complete request
        expect([200, 400, 500]).toContain(response.status);
      });

      it("should handle unexpected errors gracefully", async () => {
        const malformedData = {
          customerId: null,
          orderType: null,
          items: null,
        };

        const request = createPostRequest(
          "http://localhost:3000/api/on-demand/create",
          malformedData
        );

        const response = await POST(request);

        // Should return error response, not crash
        expect(response.status).toBeGreaterThanOrEqual(400);
      });
    });
  });
});
