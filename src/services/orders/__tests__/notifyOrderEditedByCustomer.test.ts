import {
  notifyOrderEditedByCustomer,
  type NotifyOrderEditedInput,
} from "../notifyOrderEditedByCustomer";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/config/order-notifications", () => ({
  getOrderNotificationConfig: jest.fn(),
}));

jest.mock("@/utils/email-resilience", () => ({
  sendEmailWithResilience: jest.fn(),
}));

jest.mock("@sentry/nextjs", () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

// Mock Resend so the module-level `new Resend()` inside the lazy getter
// does not need a real API key.
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn() },
  })),
}));

import { getOrderNotificationConfig } from "@/config/order-notifications";
import { sendEmailWithResilience } from "@/utils/email-resilience";
import * as Sentry from "@sentry/nextjs";

const mockConfig = getOrderNotificationConfig as jest.Mock;
const mockSendWithResilience = sendEmailWithResilience as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeInput(overrides?: Partial<NotifyOrderEditedInput>): NotifyOrderEditedInput {
  return {
    orderNumber: "CAT001",
    editorName: "Test Vendor",
    editorEmail: "vendor@example.com",
    editorRole: "VENDOR",
    changes: [
      {
        field: "headcount",
        label: "Headcount",
        oldValue: "20",
        newValue: "40",
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.mockReturnValue({
    recipients: ["ops@readysetllc.com"],
    enabled: true,
  });
  mockSendWithResilience.mockResolvedValue(undefined);
});

describe("notifyOrderEditedByCustomer", () => {
  // -----------------------------------------------------------------------
  // Disabled config
  // -----------------------------------------------------------------------

  it("returns disabled and does not send when config.enabled is false", async () => {
    mockConfig.mockReturnValue({ recipients: [], enabled: false });

    const result = await notifyOrderEditedByCustomer(makeInput());

    expect(result).toEqual({ sent: false, reason: "disabled" });
    expect(mockSendWithResilience).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Happy path — one field changed
  // -----------------------------------------------------------------------

  it("sends an email when one field changed (headcount)", async () => {
    const result = await notifyOrderEditedByCustomer(makeInput());

    expect(result).toEqual({ sent: true });
    expect(mockSendWithResilience).toHaveBeenCalledTimes(1);

    // The operation passed to sendEmailWithResilience is an async function.
    // We verify it was called (the send details are inside the closure).
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Happy path — both fields changed
  // -----------------------------------------------------------------------

  it("sends an email when both fields changed", async () => {
    const input = makeInput({
      changes: [
        {
          field: "headcount",
          label: "Headcount",
          oldValue: "20",
          newValue: "40",
        },
        {
          field: "orderTotal",
          label: "Order Total ($)",
          oldValue: "$500.00",
          newValue: "$1,250.50",
        },
      ],
    });

    const result = await notifyOrderEditedByCustomer(input);

    expect(result).toEqual({ sent: true });
    expect(mockSendWithResilience).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Send failure — resolves, never rejects
  // -----------------------------------------------------------------------

  it("returns send_failed and reports to Sentry when send throws", async () => {
    const boom = new Error("Resend exploded");
    mockSendWithResilience.mockRejectedValue(boom);

    const result = await notifyOrderEditedByCustomer(makeInput());

    expect(result).toEqual({ sent: false, reason: "send_failed" });
    expect(Sentry.captureException).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({
        tags: expect.objectContaining({
          operation: "notifyOrderEditedByCustomer",
          editorRole: "VENDOR",
        }),
        extra: { orderNumber: "CAT001" },
      }),
    );
  });

  // -----------------------------------------------------------------------
  // orderNumber in extra, never in tags (cardinality risk)
  // -----------------------------------------------------------------------

  it("puts orderNumber in extra, not tags", async () => {
    mockSendWithResilience.mockRejectedValue(new Error("fail"));

    await notifyOrderEditedByCustomer(makeInput());

    const ctx = (Sentry.captureException as jest.Mock).mock.calls[0][1];
    expect(ctx.extra.orderNumber).toBe("CAT001");
    expect(ctx.tags).not.toHaveProperty("orderNumber");
  });

  // -----------------------------------------------------------------------
  // CLIENT role
  // -----------------------------------------------------------------------

  it("works for CLIENT role the same way", async () => {
    const input = makeInput({
      editorRole: "CLIENT",
      editorEmail: "client@example.com",
      editorName: "Test Client",
    });

    const result = await notifyOrderEditedByCustomer(input);

    expect(result).toEqual({ sent: true });
    expect(mockSendWithResilience).toHaveBeenCalledTimes(1);
  });
});
