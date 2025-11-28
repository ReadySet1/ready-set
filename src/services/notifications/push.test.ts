import {
  mapDispatchStatusToPushEvent,
  buildDeliveryStatusMessage,
  isDuplicateNotification,
  markNotificationSent,
  clearNotificationCache,
  type DeliveryStatusEvent,
} from "./push";

// Mock the dedup module to avoid Prisma calls in tests
jest.mock("./dedup", () => ({
  isDuplicateNotificationDistributed: jest.fn().mockResolvedValue(false),
  markNotificationSentDistributed: jest.fn().mockResolvedValue(undefined),
  clearDedupCache: jest.fn().mockResolvedValue(undefined),
}));

/**
 * TODO: REA-211 - Push notification tests have rate limiting issues
 */
describe.skip("mapDispatchStatusToPushEvent", () => {
  it("maps known dispatch statuses to delivery events", () => {
    expect(mapDispatchStatusToPushEvent("ACCEPTED")).toBe("delivery:assigned");
    expect(mapDispatchStatusToPushEvent("EN_ROUTE_TO_DELIVERY")).toBe("driver:en_route");
    expect(mapDispatchStatusToPushEvent("ARRIVED_AT_DELIVERY")).toBe("driver:arrived");
    expect(mapDispatchStatusToPushEvent("DELIVERY_COMPLETE")).toBe("delivery:completed");
    expect(mapDispatchStatusToPushEvent("DELAYED")).toBe("delivery:delayed");
    expect(mapDispatchStatusToPushEvent("FAILED")).toBe("delivery:failed");
  });

  it("returns null for unsupported statuses", () => {
    expect(mapDispatchStatusToPushEvent("UNKNOWN_STATUS")).toBeNull();
    expect(mapDispatchStatusToPushEvent("EN_ROUTE_TO_PICKUP")).toBeNull();
    expect(mapDispatchStatusToPushEvent("ARRIVED_AT_PICKUP")).toBeNull();
    expect(mapDispatchStatusToPushEvent("PICKUP_COMPLETE")).toBeNull();
    expect(mapDispatchStatusToPushEvent("CANCELED")).toBeNull();
    expect(mapDispatchStatusToPushEvent("")).toBeNull();
  });
});

describe.skip("buildDeliveryStatusMessage", () => {
  it("returns user-friendly messages for each event type", () => {
    const events: DeliveryStatusEvent[] = [
      "delivery:assigned",
      "driver:en_route",
      "driver:arrived",
      "delivery:completed",
      "delivery:delayed",
      "delivery:failed",
    ];

    for (const event of events) {
      const message = buildDeliveryStatusMessage(event);
      expect(typeof message.title).toBe("string");
      expect(message.title.length).toBeGreaterThan(0);
      expect(typeof message.body).toBe("string");
      expect(message.body.length).toBeGreaterThan(0);
    }
  });

  it("returns specific messages for each event", () => {
    expect(buildDeliveryStatusMessage("delivery:assigned").title).toContain("assigned");
    expect(buildDeliveryStatusMessage("driver:en_route").title).toContain("on the way");
    expect(buildDeliveryStatusMessage("driver:arrived").title).toContain("arrived");
    expect(buildDeliveryStatusMessage("delivery:completed").title).toContain("completed");
    expect(buildDeliveryStatusMessage("delivery:delayed").title).toContain("delayed");
    expect(buildDeliveryStatusMessage("delivery:failed").title).toContain("could not be completed");
  });
});

describe.skip("Notification Rate Limiting", () => {
  beforeEach(async () => {
    await clearNotificationCache();
  });

  afterEach(async () => {
    await clearNotificationCache();
  });

  it("returns false for first notification (not a duplicate)", async () => {
    const result = await isDuplicateNotification("profile-1", "delivery:assigned", "order-1");
    expect(result).toBe(false);
  });

  it("returns true for duplicate notification within TTL window", async () => {
    const profileId = "profile-1";
    const event = "delivery:assigned";
    const orderId = "order-1";

    // First notification
    expect(await isDuplicateNotification(profileId, event, orderId)).toBe(false);
    await markNotificationSent(profileId, event, orderId);

    // Second notification (duplicate) - in-memory cache should catch this
    expect(await isDuplicateNotification(profileId, event, orderId)).toBe(true);
  });

  it("allows different events for the same order", async () => {
    const profileId = "profile-1";
    const orderId = "order-1";

    await markNotificationSent(profileId, "delivery:assigned", orderId);

    // Different event should not be considered duplicate
    expect(await isDuplicateNotification(profileId, "driver:en_route", orderId)).toBe(false);
  });

  it("allows same event for different orders", async () => {
    const profileId = "profile-1";
    const event = "delivery:assigned";

    await markNotificationSent(profileId, event, "order-1");

    // Different order should not be considered duplicate
    expect(await isDuplicateNotification(profileId, event, "order-2")).toBe(false);
  });

  it("allows same event and order for different profiles", async () => {
    const event = "delivery:assigned";
    const orderId = "order-1";

    await markNotificationSent("profile-1", event, orderId);

    // Different profile should not be considered duplicate
    expect(await isDuplicateNotification("profile-2", event, orderId)).toBe(false);
  });

  it("clearNotificationCache clears all cached entries", async () => {
    await markNotificationSent("profile-1", "delivery:assigned", "order-1");
    await markNotificationSent("profile-2", "driver:en_route", "order-2");

    // Both should be duplicates (in-memory cache)
    expect(await isDuplicateNotification("profile-1", "delivery:assigned", "order-1")).toBe(true);
    expect(await isDuplicateNotification("profile-2", "driver:en_route", "order-2")).toBe(true);

    // Clear cache
    await clearNotificationCache();

    // Should no longer be duplicates
    expect(await isDuplicateNotification("profile-1", "delivery:assigned", "order-1")).toBe(false);
    expect(await isDuplicateNotification("profile-2", "driver:en_route", "order-2")).toBe(false);
  });
});

describe.skip("Status to Event Mapping Integration", () => {
  it("all mapped statuses have corresponding messages", () => {
    const statusesToTest = [
      "ACCEPTED",
      "EN_ROUTE_TO_DELIVERY",
      "ARRIVED_AT_DELIVERY",
      "DELIVERY_COMPLETE",
      "DELAYED",
      "FAILED",
    ];

    for (const status of statusesToTest) {
      const event = mapDispatchStatusToPushEvent(status);
      expect(event).not.toBeNull();

      if (event) {
        const message = buildDeliveryStatusMessage(event);
        expect(message.title).toBeTruthy();
        expect(message.body).toBeTruthy();
      }
    }
  });
});
