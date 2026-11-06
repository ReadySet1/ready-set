import {
  customerOrderEditSchema,
  getCustomerEditBlockReason,
  CUSTOMER_EDITABLE_ORDER_STATUSES,
  MAX_HEADCOUNT,
  MAX_ORDER_TOTAL,
  type CustomerEditableOrder,
} from "../customer-order-edit";

import { ORDER_TRANSITIONS } from "@/lib/state-machine/order-state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function editableOrder(
  overrides: Partial<CustomerEditableOrder> = {},
): CustomerEditableOrder {
  return {
    order_type: "catering",
    userId: "user-1",
    status: "ACTIVE",
    driverStatus: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Schema — accepts
// ---------------------------------------------------------------------------

describe("customerOrderEditSchema", () => {
  it("accepts headcount only", () => {
    expect(customerOrderEditSchema.safeParse({ headcount: 40 }).success).toBe(
      true,
    );
  });

  it("accepts orderTotal only", () => {
    expect(
      customerOrderEditSchema.safeParse({ orderTotal: 1250.5 }).success,
    ).toBe(true);
  });

  it("accepts both fields", () => {
    expect(
      customerOrderEditSchema.safeParse({ headcount: 10, orderTotal: 500 })
        .success,
    ).toBe(true);
  });

  it("accepts null headcount", () => {
    expect(
      customerOrderEditSchema.safeParse({ headcount: null }).success,
    ).toBe(true);
  });

  it("accepts null orderTotal", () => {
    expect(
      customerOrderEditSchema.safeParse({ orderTotal: null }).success,
    ).toBe(true);
  });

  it("accepts headcount at MAX_HEADCOUNT", () => {
    expect(
      customerOrderEditSchema.safeParse({ headcount: MAX_HEADCOUNT }).success,
    ).toBe(true);
  });

  it("accepts orderTotal at MAX_ORDER_TOTAL", () => {
    expect(
      customerOrderEditSchema.safeParse({ orderTotal: MAX_ORDER_TOTAL })
        .success,
    ).toBe(true);
  });

  it("accepts orderTotal with 2 decimals", () => {
    expect(
      customerOrderEditSchema.safeParse({ orderTotal: 10.99 }).success,
    ).toBe(true);
  });

  it("accepts orderTotal with 1 decimal", () => {
    expect(
      customerOrderEditSchema.safeParse({ orderTotal: 10.5 }).success,
    ).toBe(true);
  });

  it("accepts orderTotal as integer", () => {
    expect(
      customerOrderEditSchema.safeParse({ orderTotal: 100 }).success,
    ).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Schema — rejects
  // ---------------------------------------------------------------------------

  it("rejects empty object", () => {
    expect(customerOrderEditSchema.safeParse({}).success).toBe(false);
  });

  it("rejects extra key", () => {
    const result = customerOrderEditSchema.safeParse({
      headcount: 10,
      tip: 5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects string headcount", () => {
    expect(
      customerOrderEditSchema.safeParse({ headcount: "40" }).success,
    ).toBe(false);
  });

  it("rejects string orderTotal", () => {
    expect(
      customerOrderEditSchema.safeParse({ orderTotal: "100" }).success,
    ).toBe(false);
  });

  it("rejects non-integer headcount (5.9)", () => {
    expect(
      customerOrderEditSchema.safeParse({ headcount: 5.9 }).success,
    ).toBe(false);
  });

  it("rejects zero headcount", () => {
    expect(customerOrderEditSchema.safeParse({ headcount: 0 }).success).toBe(
      false,
    );
  });

  it("rejects negative headcount", () => {
    expect(customerOrderEditSchema.safeParse({ headcount: -1 }).success).toBe(
      false,
    );
  });

  it("rejects headcount over INT4 ceiling", () => {
    expect(
      customerOrderEditSchema.safeParse({ headcount: MAX_HEADCOUNT + 1 })
        .success,
    ).toBe(false);
  });

  it("rejects zero orderTotal", () => {
    expect(
      customerOrderEditSchema.safeParse({ orderTotal: 0 }).success,
    ).toBe(false);
  });

  it("rejects negative orderTotal", () => {
    expect(
      customerOrderEditSchema.safeParse({ orderTotal: -5 }).success,
    ).toBe(false);
  });

  it("rejects orderTotal with 3 decimals (10.999)", () => {
    expect(
      customerOrderEditSchema.safeParse({ orderTotal: 10.999 }).success,
    ).toBe(false);
  });

  it("rejects orderTotal over ceiling", () => {
    expect(
      customerOrderEditSchema.safeParse({ orderTotal: MAX_ORDER_TOTAL + 1 })
        .success,
    ).toBe(false);
  });

  it("rejects NaN headcount", () => {
    expect(
      customerOrderEditSchema.safeParse({ headcount: NaN }).success,
    ).toBe(false);
  });

  it("rejects Infinity orderTotal", () => {
    expect(
      customerOrderEditSchema.safeParse({ orderTotal: Infinity }).success,
    ).toBe(false);
  });

  it("rejects extra key status", () => {
    expect(
      customerOrderEditSchema.safeParse({ headcount: 10, status: "ACTIVE" })
        .success,
    ).toBe(false);
  });

  it("rejects extra key driverStatus", () => {
    expect(
      customerOrderEditSchema.safeParse({
        headcount: 10,
        driverStatus: "PICKED_UP",
      }).success,
    ).toBe(false);
  });

  it("rejects extra key driver_status", () => {
    expect(
      customerOrderEditSchema.safeParse({
        headcount: 10,
        driver_status: "PICKED_UP",
      }).success,
    ).toBe(false);
  });

  it("rejects extra key specialNotes", () => {
    expect(
      customerOrderEditSchema.safeParse({
        headcount: 10,
        specialNotes: "hello",
      }).success,
    ).toBe(false);
  });

  it("rejects extra key pickupAddress", () => {
    expect(
      customerOrderEditSchema.safeParse({
        headcount: 10,
        pickupAddress: "123 Main",
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getCustomerEditBlockReason
// ---------------------------------------------------------------------------

describe("getCustomerEditBlockReason", () => {
  // ---- Editable (returns null) -------------------------------------------

  it.each(["PENDING", "CONFIRMED", "ACTIVE"])(
    "returns null for %s status with null driverStatus",
    (status) => {
      expect(
        getCustomerEditBlockReason(
          editableOrder({ status, driverStatus: null }),
          "user-1",
        ),
      ).toBeNull();
    },
  );

  it("returns null when driverStatus is undefined", () => {
    const order: CustomerEditableOrder = {
      order_type: "catering",
      userId: "user-1",
      status: "ACTIVE",
      // driverStatus intentionally omitted
    };
    expect(getCustomerEditBlockReason(order, "user-1")).toBeNull();
  });

  // ---- NOT_CATERING ------------------------------------------------------

  it("returns NOT_CATERING for on_demand orders", () => {
    expect(
      getCustomerEditBlockReason(
        editableOrder({ order_type: "on_demand" }),
        "user-1",
      ),
    ).toBe("NOT_CATERING");
  });

  // ---- NOT_OWNER ---------------------------------------------------------

  it("returns NOT_OWNER when userId does not match", () => {
    expect(
      getCustomerEditBlockReason(editableOrder(), "different-user"),
    ).toBe("NOT_OWNER");
  });

  it("returns NOT_OWNER when userId is null", () => {
    expect(
      getCustomerEditBlockReason(
        editableOrder({ userId: null }),
        "user-1",
      ),
    ).toBe("NOT_OWNER");
  });

  // ---- STATUS_NOT_EDITABLE -----------------------------------------------

  it.each([
    "ASSIGNED",
    "IN_PROGRESS",
    "DELIVERED",
    "COMPLETED",
    "CANCELLED",
  ])(
    "returns STATUS_NOT_EDITABLE for %s",
    (status) => {
      expect(
        getCustomerEditBlockReason(
          editableOrder({ status, driverStatus: null }),
          "user-1",
        ),
      ).toBe("STATUS_NOT_EDITABLE");
    },
  );

  // ---- DRIVER_ASSIGNED ---------------------------------------------------

  it.each([
    "ASSIGNED",
    "EN_ROUTE_TO_VENDOR",
    "ARRIVED_AT_VENDOR",
    "PICKED_UP",
    "EN_ROUTE_TO_CLIENT",
    "ARRIVED_TO_CLIENT",
    "COMPLETED",
  ])(
    "returns DRIVER_ASSIGNED when driverStatus is %s (on an ACTIVE order)",
    (driverStatus) => {
      expect(
        getCustomerEditBlockReason(
          editableOrder({ status: "ACTIVE", driverStatus }),
          "user-1",
        ),
      ).toBe("DRIVER_ASSIGNED");
    },
  );
});

// ---------------------------------------------------------------------------
// Drift guard — CUSTOMER_EDITABLE_ORDER_STATUSES vs ORDER_TRANSITIONS
// ---------------------------------------------------------------------------

describe("drift guard", () => {
  it("every editable status can transition to ASSIGNED in ORDER_TRANSITIONS", () => {
    for (const status of CUSTOMER_EDITABLE_ORDER_STATUSES) {
      const targets = ORDER_TRANSITIONS[status as keyof typeof ORDER_TRANSITIONS];
      expect(targets).toContain("ASSIGNED");
    }
  });

  it("no non-editable status can transition to ASSIGNED", () => {
    const editableSet = new Set<string>(CUSTOMER_EDITABLE_ORDER_STATUSES);
    for (const [status, targets] of Object.entries(ORDER_TRANSITIONS)) {
      if (editableSet.has(status)) continue;
      expect(targets).not.toContain("ASSIGNED");
    }
  });
});
