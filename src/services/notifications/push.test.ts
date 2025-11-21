import { mapDispatchStatusToPushEvent, buildDeliveryStatusMessage } from "./push";

describe("mapDispatchStatusToPushEvent", () => {
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
  });
});

describe("buildDeliveryStatusMessage", () => {
  it("returns user-friendly messages for each event type", () => {
    const events = [
      "delivery:assigned",
      "driver:en_route",
      "driver:arrived",
      "delivery:completed",
      "delivery:delayed",
      "delivery:failed",
    ] as const;

    for (const event of events) {
      const message = buildDeliveryStatusMessage(event);
      expect(typeof message.title).toBe("string");
      expect(message.title.length).toBeGreaterThan(0);
      expect(typeof message.body).toBe("string");
      expect(message.body.length).toBeGreaterThan(0);
    }
  });
});


