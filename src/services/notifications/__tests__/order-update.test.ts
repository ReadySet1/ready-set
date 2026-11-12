/**
 * The order-update email shows the order's times on the pickup address clock,
 * not the server's clock (the VPS runs on UTC).
 */
import { sendOrderUpdateNotification } from "../order-update";

const mockSend = jest.fn().mockResolvedValue({ id: "email-id" });

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

jest.mock("@/utils/email-resilience", () => ({
  sendEmailWithResilience: (fn: () => Promise<unknown>) => fn(),
}));

// 2026-11-20T17:00Z = 11:00 AM CST = 9:00 AM PST
const pickup = "2026-11-20T17:00:00.000Z";
const arrival = "2026-11-20T18:30:00.000Z";

function sentHtml(): string {
  const call = mockSend.mock.calls[mockSend.mock.calls.length - 1];
  return call?.[0]?.html ?? "";
}

describe("sendOrderUpdateNotification time zone", () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-key";
    mockSend.mockClear();
  });

  afterAll(() => {
    process.env.RESEND_API_KEY = originalKey;
  });

  const send = (zip: string) =>
    sendOrderUpdateNotification({
      order: {
        orderNumber: "CV-100",
        order_type: "catering",
        pickupDateTime: pickup,
        arrivalDateTime: arrival,
        orderTotal: 100,
        pickupAddress: { street1: "1 Main", city: "X", state: "TX", zip },
      },
      changes: [
        {
          field: "pickupDateTime",
          oldValue: "2026-11-20T16:00:00.000Z",
          newValue: pickup,
          isSignificant: true,
        },
      ],
      customerEmail: "c@example.com",
      customerName: "Customer",
    });

  it("shows an Austin order's times on the Central clock", async () => {
    await expect(send("78701")).resolves.toEqual({ success: true });

    const html = sentHtml();
    expect(html).toContain("Friday, November 20, 2026 10:00 AM CT");
    expect(html).toContain("Friday, November 20, 2026 11:00 AM CT");
    expect(html).toContain("Friday, November 20, 2026 12:30 PM CT");
  });

  it("shows a California order's times on the Pacific clock", async () => {
    await send("94103");

    expect(sentHtml()).toContain("Friday, November 20, 2026 9:00 AM PT");
  });
});
