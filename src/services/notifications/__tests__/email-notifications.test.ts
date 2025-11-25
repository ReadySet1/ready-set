import {
  sendDeliveryStatusEmail,
  PreferenceError,
  type DeliveryDetails,
} from "@/services/notifications/email";

// Mock the email utility (Resend)
const mockSendEmail = jest.fn().mockResolvedValue({ id: "mock-email-id" });

jest.mock("@/utils/email", () => ({
  sendEmail: (data: unknown) => mockSendEmail(data),
}));

// Mock the template renderer
jest.mock("@/lib/email/renderTemplate", () => ({
  renderDeliveryTemplate: jest.fn().mockReturnValue({
    html: "<html>Test email</html>",
    text: "Test email",
  }),
}));

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
    unsubscribeLink: "https://test.readysetllc.com/account/preferences?tab=notifications",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("ASSIGNED status", () => {
    it("sends email for ASSIGNED status", async () => {
      await sendDeliveryStatusEmail({
        driverStatus: "ASSIGNED",
        details: baseDetails,
        preferences: { deliveryNotifications: true },
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "customer@example.com",
          subject: expect.stringContaining("ORD-123"),
        })
      );
    });
  });

  describe("EN_ROUTE_TO_CLIENT status", () => {
    it("sends email for EN_ROUTE_TO_CLIENT status", async () => {
      await sendDeliveryStatusEmail({
        driverStatus: "EN_ROUTE_TO_CLIENT",
        details: baseDetails,
        preferences: { deliveryNotifications: true },
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("on the way"),
        })
      );
    });
  });

  describe("ARRIVED_TO_CLIENT status", () => {
    it("sends email for ARRIVED_TO_CLIENT status", async () => {
      await sendDeliveryStatusEmail({
        driverStatus: "ARRIVED_TO_CLIENT",
        details: baseDetails,
        preferences: { deliveryNotifications: true },
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("has arrived"),
        })
      );
    });
  });

  describe("COMPLETED status", () => {
    it("sends email for COMPLETED status", async () => {
      await sendDeliveryStatusEmail({
        driverStatus: "COMPLETED",
        details: baseDetails,
        preferences: { deliveryNotifications: true },
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("complete"),
        })
      );
    });
  });

  describe("preference handling", () => {
    it("does nothing when delivery notifications are disabled", async () => {
      await sendDeliveryStatusEmail({
        driverStatus: "ASSIGNED",
        details: baseDetails,
        preferences: { deliveryNotifications: false },
      });

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("does nothing when preferences is null", async () => {
      await sendDeliveryStatusEmail({
        driverStatus: "ASSIGNED",
        details: baseDetails,
        preferences: null,
      });

      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe("unmapped statuses", () => {
    it("does nothing for ARRIVED_AT_VENDOR status (not customer-facing)", async () => {
      await sendDeliveryStatusEmail({
        driverStatus: "ARRIVED_AT_VENDOR",
        details: baseDetails,
        preferences: { deliveryNotifications: true },
      });

      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it("throws PreferenceError when customer email is missing", async () => {
      const detailsWithoutEmail = {
        ...baseDetails,
        customerEmail: "",
      };

      await expect(
        sendDeliveryStatusEmail({
          driverStatus: "ASSIGNED",
          details: detailsWithoutEmail,
          preferences: { deliveryNotifications: true },
        })
      ).rejects.toThrow(PreferenceError);
    });
  });

  describe("optional fields", () => {
    it("handles missing driver name gracefully", async () => {
      const detailsWithoutDriver = {
        ...baseDetails,
        driverName: undefined,
      };

      await sendDeliveryStatusEmail({
        driverStatus: "ASSIGNED",
        details: detailsWithoutDriver,
        preferences: { deliveryNotifications: true },
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it("handles missing estimated arrival gracefully", async () => {
      const detailsWithoutETA = {
        ...baseDetails,
        estimatedArrival: undefined,
      };

      await sendDeliveryStatusEmail({
        driverStatus: "ASSIGNED",
        details: detailsWithoutETA,
        preferences: { deliveryNotifications: true },
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });
  });
});
