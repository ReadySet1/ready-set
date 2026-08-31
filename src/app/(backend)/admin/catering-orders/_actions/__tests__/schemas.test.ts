import { createCateringOrderSchema } from "../schemas";

/** Valid base fixture — every required field filled, needHost = NO. */
const validBase = {
  userId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  orderNumber: "ORD-TEST-001",
  brokerage: "Direct Delivery",
  pickupDateTime: new Date("2025-06-15T10:00:00"),
  arrivalDateTime: new Date("2025-06-15T11:00:00"),
  completeDateTime: null,
  headcount: 50,
  needHost: "NO" as const,
  hoursNeeded: null,
  numberOfHosts: null,
  clientAttention: null,
  pickupNotes: null,
  specialNotes: null,
  orderTotal: 1250.5,
  tip: null,
  pickupAddress: {
    street1: "123 Food St",
    city: "San Francisco",
    state: "CA",
    zip: "94103",
  },
  deliveryAddress: {
    street1: "456 Work Ave",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
  },
};

describe("createCateringOrderSchema — headcount / orderTotal rule", () => {
  it("Case 1: headcount provided, orderTotal null → passes", () => {
    const result = createCateringOrderSchema.safeParse({
      ...validBase,
      headcount: 50,
      orderTotal: null,
    });
    expect(result.success).toBe(true);
  });

  it("Case 2: headcount null, orderTotal provided → passes", () => {
    const result = createCateringOrderSchema.safeParse({
      ...validBase,
      headcount: null,
      orderTotal: 1250.5,
    });
    expect(result.success).toBe(true);
  });

  it("Case 3: both headcount and orderTotal provided → passes", () => {
    const result = createCateringOrderSchema.safeParse({
      ...validBase,
      headcount: 50,
      orderTotal: 1250.5,
    });
    expect(result.success).toBe(true);
  });

  it("Case 4: both null → fails with issue on both paths", () => {
    const result = createCateringOrderSchema.safeParse({
      ...validBase,
      headcount: null,
      orderTotal: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("headcount");
      expect(paths).toContain("orderTotal");
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(
        "Provide at least one: Headcount or Order Total.",
      );
    }
  });

  it('Case 5: both empty strings → fails (preprocess maps "" → null)', () => {
    const result = createCateringOrderSchema.safeParse({
      ...validBase,
      headcount: "",
      orderTotal: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("headcount");
      expect(paths).toContain("orderTotal");
    }
  });

  it("Case 6: both zero → fails on existing positive() rules, not the new one", () => {
    const result = createCateringOrderSchema.safeParse({
      ...validBase,
      headcount: 0,
      orderTotal: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      // Should hit the positive() validators, not our custom "at least one" message
      expect(messages).toContain("Headcount must be a positive integer");
      expect(messages).toContain("Order total must be positive");
      expect(messages).not.toContain(
        "Provide at least one: Headcount or Order Total.",
      );
    }
  });
});
