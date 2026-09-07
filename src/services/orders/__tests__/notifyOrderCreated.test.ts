import {
  notifyOrderCreated,
  buildOrderNotificationData,
} from "../notifyOrderCreated";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    cateringRequest: { findUnique: jest.fn() },
    onDemand: { findUnique: jest.fn() },
  },
}));

jest.mock("@/services/email-notification", () => ({
  sendOrderNotificationToAdmin: jest.fn(),
}));

jest.mock("@/config/order-notifications", () => ({
  getOrderNotificationConfig: jest.fn(),
}));

jest.mock("@sentry/nextjs", () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { sendOrderNotificationToAdmin } from "@/services/email-notification";
import { getOrderNotificationConfig } from "@/config/order-notifications";
import * as Sentry from "@sentry/nextjs";

const mockPrisma = prisma as unknown as {
  cateringRequest: { findUnique: jest.Mock };
  onDemand: { findUnique: jest.Mock };
};
const mockSend = sendOrderNotificationToAdmin as jest.Mock;
const mockConfig = getOrderNotificationConfig as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAddress(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "addr-1",
    street1: "123 Main St",
    street2: null,
    city: "Austin",
    state: "TX",
    zip: "78701",
    county: "Travis",
    createdAt: new Date(),
    updatedAt: new Date(),
    isRestaurant: false,
    isShared: false,
    locationNumber: null,
    parkingLoading: null,
    name: null,
    latitude: null,
    longitude: null,
    deletedAt: null,
    ...overrides,
  };
}

function makeUser(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "user-1",
    guid: null,
    name: "Test User",
    email: "test@example.com",
    image: null,
    type: "CLIENT",
    companyName: null,
    contactName: null,
    contactNumber: null,
    website: null,
    street1: null,
    street2: null,
    city: null,
    state: null,
    zip: null,
    locationNumber: null,
    parkingLoading: null,
    counties: null,
    timeNeeded: null,
    cateringBrokerage: null,
    frequency: null,
    provide: null,
    headCount: null,
    status: "APPROVED",
    sideNotes: null,
    confirmationCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isTemporaryPassword: false,
    deletedAt: null,
    ...overrides,
  };
}

/** Mimics a Prisma Decimal — has a toString() method. */
function makeDecimal(value: string) {
  return {
    toString: () => value,
    toNumber: () => parseFloat(value),
    valueOf: () => value,
  };
}

function makeCateringOrder(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "order-catering-1",
    guid: null,
    userId: "user-1",
    pickupAddressId: "addr-1",
    deliveryAddressId: "addr-2",
    brokerage: "TestBrokerage",
    orderNumber: "CATER-001",
    pickupDateTime: new Date("2026-09-01T10:00:00Z"),
    arrivalDateTime: new Date("2026-09-01T11:00:00Z"),
    completeDateTime: null,
    headcount: 50,
    needHost: "NO",
    hoursNeeded: 2.5,
    numberOfHosts: null,
    clientAttention: "Main lobby",
    pickupNotes: "Use back door",
    specialNotes: null,
    image: null,
    status: "ACTIVE",
    orderTotal: makeDecimal("499.99"),
    tip: makeDecimal("0.00"),
    appliedDiscount: null,
    pricingTierId: null,
    deliveryCost: null,
    deliveryDistance: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    driverStatus: null,
    ezCaterDeliveryId: null,
    deletedAt: null,
    archivedAt: null,
    archiveBatchId: null,
    user: makeUser(),
    pickupAddress: makeAddress(),
    deliveryAddress: makeAddress({ id: "addr-2" }),
    ...overrides,
  };
}

function makeOnDemandOrder(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "order-od-1",
    guid: null,
    userId: "user-1",
    pickupAddressId: "addr-1",
    deliveryAddressId: "addr-2",
    orderNumber: "OD-001",
    pickupDateTime: new Date("2026-09-01T10:00:00Z"),
    arrivalDateTime: new Date("2026-09-01T11:00:00Z"),
    completeDateTime: null,
    hoursNeeded: null,
    itemDelivered: "Office furniture",
    vehicleType: "VAN",
    clientAttention: "Reception desk",
    pickupNotes: null,
    specialNotes: "Fragile items",
    image: null,
    status: "ACTIVE",
    orderTotal: makeDecimal("250.00"),
    tip: makeDecimal("10.00"),
    length: 48.0,
    width: 24.0,
    height: 36.0,
    weight: 150.0,
    createdAt: new Date(),
    updatedAt: new Date(),
    driverStatus: null,
    deletedAt: null,
    archivedAt: null,
    archiveBatchId: null,
    user: makeUser(),
    pickupAddress: makeAddress(),
    deliveryAddress: makeAddress({ id: "addr-2" }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("notifyOrderCreated", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig.mockReturnValue({ recipients: ["admin@test.com"], enabled: true });
    mockSend.mockResolvedValue(true);
  });

  // -----------------------------------------------------------------------
  // Disabled config
  // -----------------------------------------------------------------------

  it("returns disabled and does not query DB or send when config.enabled is false", async () => {
    mockConfig.mockReturnValue({ recipients: [], enabled: false });

    const result = await notifyOrderCreated({
      orderId: "some-id",
      orderType: "catering",
      source: "admin_dashboard",
    });

    expect(result).toEqual({ sent: false, reason: "disabled" });
    expect(mockPrisma.cateringRequest.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.onDemand.findUnique).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Catering order — happy path
  // -----------------------------------------------------------------------

  it("sends a catering order notification with correctly mapped payload", async () => {
    const order = makeCateringOrder();
    mockPrisma.cateringRequest.findUnique.mockResolvedValue(order);

    const result = await notifyOrderCreated({
      orderId: "order-catering-1",
      orderType: "catering",
      source: "customer_portal",
    });

    expect(result).toEqual({ sent: true });
    expect(mockPrisma.cateringRequest.findUnique).toHaveBeenCalledWith({
      where: { id: "order-catering-1" },
      include: { user: true, pickupAddress: true, deliveryAddress: true },
    });

    const payload = mockSend.mock.calls[0][0];
    expect(payload.orderNumber).toBe("CATER-001");
    expect(payload.orderType).toBe("catering");
    expect(payload.customerName).toBe("Test User");
    expect(payload.customerEmail).toBe("test@example.com");
    expect(payload.brokerage).toBe("TestBrokerage");
    expect(payload.headcount).toBe("50");
    expect(payload.hoursNeeded).toBe("2.5");
    expect(payload.source).toBe("customer_portal");
  });

  // -----------------------------------------------------------------------
  // On-demand order — happy path
  // -----------------------------------------------------------------------

  it("sends an on-demand order notification with dimensions and weight", async () => {
    const order = makeOnDemandOrder();
    mockPrisma.onDemand.findUnique.mockResolvedValue(order);

    const result = await notifyOrderCreated({
      orderId: "order-od-1",
      orderType: "on_demand",
      source: "admin_dashboard",
    });

    expect(result).toEqual({ sent: true });
    expect(mockPrisma.onDemand.findUnique).toHaveBeenCalledWith({
      where: { id: "order-od-1" },
      include: { user: true, pickupAddress: true, deliveryAddress: true },
    });

    const payload = mockSend.mock.calls[0][0];
    expect(payload.orderType).toBe("on_demand");
    expect(payload.itemDelivered).toBe("Office furniture");
    expect(payload.vehicleType).toBe("VAN");
    expect(payload.dimensions).toEqual({
      length: "48",
      width: "24",
      height: "36",
    });
    expect(payload.weight).toBe("150");
    expect(payload.source).toBe("admin_dashboard");
  });

  // -----------------------------------------------------------------------
  // Order not found
  // -----------------------------------------------------------------------

  it("returns order_not_found and reports to Sentry when the order does not exist", async () => {
    mockPrisma.cateringRequest.findUnique.mockResolvedValue(null);

    const result = await notifyOrderCreated({
      orderId: "missing-id",
      orderType: "catering",
      source: "orders_api",
    });

    expect(result).toEqual({ sent: false, reason: "order_not_found" });
    expect(mockSend).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "Order notification: order not found",
      expect.objectContaining({
        level: "warning",
        extra: { orderId: "missing-id" },
      }),
    );
  });

  // -----------------------------------------------------------------------
  // Send returns false (silent failure — Resend down, bad key, rate limit)
  // -----------------------------------------------------------------------

  it("returns send_failed and reports to Sentry when send returns false", async () => {
    mockPrisma.cateringRequest.findUnique.mockResolvedValue(makeCateringOrder());
    mockSend.mockResolvedValue(false);

    const result = await notifyOrderCreated({
      orderId: "order-catering-1",
      orderType: "catering",
      source: "partner_api",
    });

    expect(result).toEqual({ sent: false, reason: "send_failed" });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "Order notification send failed",
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({ source: "partner_api" }),
        extra: { orderId: "order-catering-1" },
      }),
    );
  });

  // -----------------------------------------------------------------------
  // Send throws — resolves (does not reject), Sentry.captureException
  // -----------------------------------------------------------------------

  it("resolves (never rejects) when send throws, and reports to Sentry with orderId in extra", async () => {
    const boom = new Error("Resend exploded");
    mockPrisma.cateringRequest.findUnique.mockResolvedValue(makeCateringOrder());
    mockSend.mockRejectedValue(boom);

    const result = await notifyOrderCreated({
      orderId: "order-catering-1",
      orderType: "catering",
      source: "orders_api",
    });

    expect(result).toEqual({ sent: false, reason: "send_failed" });
    expect(Sentry.captureException).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({
        tags: expect.objectContaining({ operation: "notifyOrderCreated" }),
        extra: { orderId: "order-catering-1" },
      }),
    );
    // orderId must NOT be in tags (cardinality risk)
    const sentryCall = (Sentry.captureException as jest.Mock).mock.calls[0][1];
    expect(sentryCall.tags).not.toHaveProperty("orderId");
  });

  // -----------------------------------------------------------------------
  // Decimal serialization
  // -----------------------------------------------------------------------

  it("serializes Decimal orderTotal as a string, not [object Object]", async () => {
    const order = makeCateringOrder({ orderTotal: makeDecimal("1234.56") });
    mockPrisma.cateringRequest.findUnique.mockResolvedValue(order);

    await notifyOrderCreated({
      orderId: "order-catering-1",
      orderType: "catering",
      source: "admin_dashboard",
    });

    const payload = mockSend.mock.calls[0][0];
    expect(payload.orderTotal).toBe("1234.56");
    expect(typeof payload.orderTotal).toBe("string");
  });

  // -----------------------------------------------------------------------
  // Null user fallback
  // -----------------------------------------------------------------------

  it("falls back to Unknown / unknown@example.com when user fields are null", async () => {
    const order = makeCateringOrder({
      user: makeUser({ name: null, email: null }),
    });
    mockPrisma.cateringRequest.findUnique.mockResolvedValue(order);

    await notifyOrderCreated({
      orderId: "order-catering-1",
      orderType: "catering",
      source: "admin_dashboard",
    });

    const payload = mockSend.mock.calls[0][0];
    expect(payload.customerName).toBe("Unknown");
    expect(payload.customerEmail).toBe("unknown@example.com");
  });
});

// ---------------------------------------------------------------------------
// buildOrderNotificationData (pure mapper)
// ---------------------------------------------------------------------------

describe("buildOrderNotificationData", () => {
  it("maps a catering order with all fields", () => {
    const order = makeCateringOrder() as any;
    const data = buildOrderNotificationData(order, "catering", "customer_portal");

    expect(data.orderNumber).toBe("CATER-001");
    expect(data.orderType).toBe("catering");
    expect(data.brokerage).toBe("TestBrokerage");
    expect(data.headcount).toBe("50");
    expect(data.source).toBe("customer_portal");
    expect(data.pickupAddress.city).toBe("Austin");
  });

  it("maps an on-demand order with dimensions", () => {
    const order = makeOnDemandOrder() as any;
    const data = buildOrderNotificationData(order, "on_demand", "admin_dashboard");

    expect(data.orderType).toBe("on_demand");
    expect(data.itemDelivered).toBe("Office furniture");
    expect(data.vehicleType).toBe("VAN");
    expect(data.dimensions).toEqual({
      length: "48",
      width: "24",
      height: "36",
    });
    expect(data.weight).toBe("150");
    expect(data.source).toBe("admin_dashboard");
  });

  it("handles null orderTotal gracefully", () => {
    const order = makeCateringOrder({ orderTotal: null }) as any;
    const data = buildOrderNotificationData(order, "catering", "orders_api");
    expect(data.orderTotal).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// runAfterResponse error path
// ---------------------------------------------------------------------------

describe("runAfterResponse error handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs the error and does not throw when notifyOrderCreated rejects inside runAfterResponse", async () => {
    // Import the real runAfterResponse — outside a request scope it falls
    // back to inline execution, so the catch handler fires synchronously.
    const { runAfterResponse } = jest.requireActual<
      typeof import("@/lib/api/after-response")
    >("@/lib/api/after-response");

    // Make getOrderNotificationConfig throw synchronously (sits outside
    // the try block inside notifyOrderCreated).
    mockConfig.mockImplementation(() => {
      throw new Error("config exploded");
    });

    const errorSpy = jest.spyOn(console, "error").mockImplementation();

    // Should not throw
    runAfterResponse("admin-order-notification", () =>
      notifyOrderCreated({
        orderId: "any",
        orderType: "catering",
        source: "orders_api",
      }),
    );

    // Flush microtask queue so the inline promise resolves
    await new Promise((r) => setTimeout(r, 50));

    expect(errorSpy).toHaveBeenCalledWith(
      "admin-order-notification",
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });
});
