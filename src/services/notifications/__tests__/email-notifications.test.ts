import { DriverStatus } from "@/types/user";
import {
  sendDeliveryStatusEmail,
  type DeliveryDetails,
} from "@/services/notifications/email";

jest.mock("@/lib/email/sendgrid", () => {
  return {
    SendGridEmailProvider: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({ success: true }),
    })),
  };
});

describe("sendDeliveryStatusEmail", () => {
  const baseDetails: DeliveryDetails = {
    deliveryId: "del-123",
    orderNumber: "ORD-123",
    customerEmail: "customer@example.com",
    customerName: "Customer Name",
    driverName: "Driver One",
    estimatedArrival: "2025-01-01T10:00:00.000Z",
    deliveryAddress: "123 Main St, City, ST 12345",
    trackingLink: "https://test.readysetllc.com/orders/ORD-123",
    supportLink: "https://test.readysetllc.com/contact",
  };

  it("sends email for ASSIGNED status", async () => {
    await expect(
      sendDeliveryStatusEmail({
        driverStatus: DriverStatus.ASSIGNED,
        details: baseDetails,
        preferences: { deliveryNotifications: true, promotionalEmails: false },
      })
    ).resolves.toBeUndefined();
  });

  it("does nothing when delivery notifications are disabled", async () => {
    await expect(
      sendDeliveryStatusEmail({
        driverStatus: DriverStatus.ASSIGNED,
        details: baseDetails,
        preferences: { deliveryNotifications: false, promotionalEmails: false },
      })
    ).resolves.toBeUndefined();
  });

  it("does nothing for statuses that are not mapped", async () => {
    await expect(
      sendDeliveryStatusEmail({
        driverStatus: DriverStatus.ARRIVED_AT_VENDOR,
        details: baseDetails,
        preferences: { deliveryNotifications: true, promotionalEmails: false },
      })
    ).resolves.toBeUndefined();
  });
});


