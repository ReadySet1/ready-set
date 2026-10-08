import {
  customerOrderEditSchema,
  getCustomerEditBlockReason,
  CUSTOMER_EDIT_LOCKED_DRIVER_STATUSES,
  MAX_HEADCOUNT,
  MAX_ORDER_TOTAL,
  type CustomerEditableOrder,
} from "../customer-order-edit";

// Server-only import — safe in a test file, not in the production module.
import { POST_PICKUP_DRIVER_STATUSES } from "@/lib/services/return-requests";

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
  it("returns null for an editable order", () => {
    expect(getCustomerEditBlockReason(editableOrder(), "user-1")).toBeNull();
  });

  it("returns null when driverStatus is null", () => {
    expect(
      getCustomerEditBlockReason(
        editableOrder({ driverStatus: null }),
        "user-1",
      ),
    ).toBeNull();
  });

  it("returns null when driverStatus is ASSIGNED", () => {
    expect(
      getCustomerEditBlockReason(
        editableOrder({ driverStatus: "ASSIGNED" }),
        "user-1",
      ),
    ).toBeNull();
  });

  it("returns null when driverStatus is EN_ROUTE_TO_VENDOR", () => {
    expect(
      getCustomerEditBlockReason(
        editableOrder({ driverStatus: "EN_ROUTE_TO_VENDOR" }),
        "user-1",
      ),
    ).toBeNull();
  });

  it("returns null when driverStatus is ARRIVED_AT_VENDOR", () => {
    expect(
      getCustomerEditBlockReason(
        editableOrder({ driverStatus: "ARRIVED_AT_VENDOR" }),
        "user-1",
      ),
    ).toBeNull();
  });

  it("returns NOT_CATERING for on_demand orders", () => {
    expect(
      getCustomerEditBlockReason(
        editableOrder({ order_type: "on_demand" }),
        "user-1",
      ),
    ).toBe("NOT_CATERING");
  });

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

  it("returns TERMINAL_STATUS for COMPLETED", () => {
    expect(
      getCustomerEditBlockReason(
        editableOrder({ status: "COMPLETED" }),
        "user-1",
      ),
    ).toBe("TERMINAL_STATUS");
  });

  it("returns TERMINAL_STATUS for DELIVERED", () => {
    expect(
      getCustomerEditBlockReason(
        editableOrder({ status: "DELIVERED" }),
        "user-1",
      ),
    ).toBe("TERMINAL_STATUS");
  });

  it("returns TERMINAL_STATUS for CANCELLED", () => {
    expect(
      getCustomerEditBlockReason(
        editableOrder({ status: "CANCELLED" }),
        "user-1",
      ),
    ).toBe("TERMINAL_STATUS");
  });

  it("returns ALREADY_PICKED_UP for driverStatus PICKED_UP", () => {
    expect(
      getCustomerEditBlockReason(
        editableOrder({ driverStatus: "PICKED_UP" }),
        "user-1",
      ),
    ).toBe("ALREADY_PICKED_UP");
  });

  it("returns ALREADY_PICKED_UP for driverStatus EN_ROUTE_TO_CLIENT", () => {
    expect(
      getCustomerEditBlockReason(
        editableOrder({ driverStatus: "EN_ROUTE_TO_CLIENT" }),
        "user-1",
      ),
    ).toBe("ALREADY_PICKED_UP");
  });

  it("returns ALREADY_PICKED_UP for driverStatus ARRIVED_TO_CLIENT", () => {
    expect(
      getCustomerEditBlockReason(
        editableOrder({ driverStatus: "ARRIVED_TO_CLIENT" }),
        "user-1",
      ),
    ).toBe("ALREADY_PICKED_UP");
  });

  it("returns ALREADY_PICKED_UP for driverStatus COMPLETED", () => {
    expect(
      getCustomerEditBlockReason(
        editableOrder({ driverStatus: "COMPLETED" }),
        "user-1",
      ),
    ).toBe("ALREADY_PICKED_UP");
  });
});

// ---------------------------------------------------------------------------
// Drift guard
// ---------------------------------------------------------------------------

describe("drift guard", () => {
  it("CUSTOMER_EDIT_LOCKED_DRIVER_STATUSES matches POST_PICKUP_DRIVER_STATUSES", () => {
    expect([...CUSTOMER_EDIT_LOCKED_DRIVER_STATUSES]).toEqual(
      POST_PICKUP_DRIVER_STATUSES,
    );
  });
});
