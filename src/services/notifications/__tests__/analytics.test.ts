/**
 * Tests for the notification analytics service.
 */

import {
  trackNotification,
  markNotificationDelivered,
  markNotificationFailed,
  markNotificationClicked,
  getNotificationMetrics,
  cleanupOldAnalytics,
} from "../analytics";

// Mock Prisma
jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    notificationAnalytics: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

// Mock Sentry
jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockSentry = Sentry as jest.Mocked<typeof Sentry>;

describe("notification analytics service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("trackNotification", () => {
    it("creates a new analytics record", async () => {
      const mockRecord = {
        id: "analytics-1",
        profileId: "profile-123",
        notificationType: "delivery_status",
        event: "delivery:completed",
        recipientType: "CUSTOMER",
        orderId: "order-456",
        dispatchId: null,
        status: "sent",
        errorMessage: null,
        fcmMessageId: "fcm-123",
        createdAt: new Date(),
        deliveredAt: null,
        clickedAt: null,
      };

      (mockPrisma.notificationAnalytics.create as jest.Mock).mockResolvedValue(mockRecord);

      const result = await trackNotification({
        profileId: "profile-123",
        notificationType: "delivery_status",
        event: "delivery:completed",
        recipientType: "CUSTOMER",
        orderId: "order-456",
        fcmMessageId: "fcm-123",
      });

      expect(result).toEqual(mockRecord);
      expect(mockPrisma.notificationAnalytics.create).toHaveBeenCalledWith({
        data: {
          profileId: "profile-123",
          notificationType: "delivery_status",
          event: "delivery:completed",
          recipientType: "CUSTOMER",
          orderId: "order-456",
          dispatchId: undefined,
          status: "sent",
          errorMessage: undefined,
          fcmMessageId: "fcm-123",
        },
      });
    });

    it("returns null on database error", async () => {
      (mockPrisma.notificationAnalytics.create as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const result = await trackNotification({
        profileId: "profile-123",
        notificationType: "delivery_status",
        event: "delivery:completed",
        recipientType: "CUSTOMER",
      });

      expect(result).toBeNull();
      expect(mockSentry.captureException).toHaveBeenCalled();
    });
  });

  describe("markNotificationDelivered", () => {
    it("updates record with delivered status and timestamp", async () => {
      const mockRecord = {
        id: "analytics-1",
        status: "delivered",
        deliveredAt: new Date(),
      };

      (mockPrisma.notificationAnalytics.update as jest.Mock).mockResolvedValue(mockRecord);

      const result = await markNotificationDelivered("analytics-1");

      expect(result).toBeTruthy();
      expect(mockPrisma.notificationAnalytics.update).toHaveBeenCalledWith({
        where: { id: "analytics-1" },
        data: {
          status: "delivered",
          deliveredAt: expect.any(Date),
        },
      });
    });
  });

  describe("markNotificationFailed", () => {
    it("updates record with failed status and error message", async () => {
      const mockRecord = {
        id: "analytics-1",
        status: "failed",
        errorMessage: "Token expired",
      };

      (mockPrisma.notificationAnalytics.update as jest.Mock).mockResolvedValue(mockRecord);

      const result = await markNotificationFailed("analytics-1", "Token expired");

      expect(result).toBeTruthy();
      expect(mockPrisma.notificationAnalytics.update).toHaveBeenCalledWith({
        where: { id: "analytics-1" },
        data: {
          status: "failed",
          errorMessage: "Token expired",
        },
      });
    });
  });

  describe("markNotificationClicked", () => {
    it("updates record with clicked status and timestamp", async () => {
      const mockRecord = {
        id: "analytics-1",
        status: "clicked",
        clickedAt: new Date(),
      };

      (mockPrisma.notificationAnalytics.update as jest.Mock).mockResolvedValue(mockRecord);

      const result = await markNotificationClicked("analytics-1");

      expect(result).toBeTruthy();
      expect(mockPrisma.notificationAnalytics.update).toHaveBeenCalledWith({
        where: { id: "analytics-1" },
        data: {
          status: "clicked",
          clickedAt: expect.any(Date),
        },
      });
    });
  });

  describe("getNotificationMetrics", () => {
    it("returns aggregated metrics for date range", async () => {
      (mockPrisma.notificationAnalytics.count as jest.Mock)
        .mockResolvedValueOnce(100) // totalSent
        .mockResolvedValueOnce(80) // totalDelivered
        .mockResolvedValueOnce(10) // totalFailed
        .mockResolvedValueOnce(20); // totalClicked

      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");

      const metrics = await getNotificationMetrics(startDate, endDate);

      expect(metrics).toEqual({
        totalSent: 100,
        totalDelivered: 80,
        totalFailed: 10,
        totalClicked: 20,
        deliveryRate: 80, // (80/100) * 100
        clickRate: 25, // (20/80) * 100
      });
    });

    it("handles zero counts gracefully", async () => {
      (mockPrisma.notificationAnalytics.count as jest.Mock).mockResolvedValue(0);

      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");

      const metrics = await getNotificationMetrics(startDate, endDate);

      expect(metrics).toEqual({
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        totalClicked: 0,
        deliveryRate: 0,
        clickRate: 0,
      });
    });
  });

  describe("cleanupOldAnalytics", () => {
    it("deletes records older than retention period", async () => {
      (mockPrisma.notificationAnalytics.deleteMany as jest.Mock).mockResolvedValue({
        count: 50,
      });

      const count = await cleanupOldAnalytics(90);

      expect(count).toBe(50);
      expect(mockPrisma.notificationAnalytics.deleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: expect.any(Date) } },
      });
    });

    it("returns 0 on error", async () => {
      (mockPrisma.notificationAnalytics.deleteMany as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const count = await cleanupOldAnalytics(90);

      expect(count).toBe(0);
      expect(mockSentry.captureException).toHaveBeenCalled();
    });
  });
});
