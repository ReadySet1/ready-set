/**
 * Tests for the notification deduplication service.
 */

import {
  getNotificationCacheKey,
  isDuplicateNotificationDistributed,
  markNotificationSentDistributed,
  clearDedupCache,
  getDedupTTLSeconds,
} from "../dedup";

// Mock Prisma
jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    notificationDedup: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("notification dedup service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getNotificationCacheKey", () => {
    it("generates a consistent cache key", () => {
      const key = getNotificationCacheKey("profile-123", "delivery:completed", "order-456");
      expect(key).toBe("profile-123:delivery:completed:order-456");
    });

    it("handles special characters in IDs", () => {
      const key = getNotificationCacheKey("abc-def-123", "event:test", "xyz-789");
      expect(key).toBe("abc-def-123:event:test:xyz-789");
    });
  });

  describe("isDuplicateNotificationDistributed", () => {
    it("returns false when no duplicate exists", async () => {
      (mockPrisma.notificationDedup.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await isDuplicateNotificationDistributed(
        "profile-123",
        "delivery:completed",
        "order-456"
      );

      expect(result).toBe(false);
      expect(mockPrisma.notificationDedup.findFirst).toHaveBeenCalledWith({
        where: {
          cacheKey: "profile-123:delivery:completed:order-456",
          createdAt: { gt: expect.any(Date) },
        },
      });
    });

    it("returns true when duplicate exists within TTL", async () => {
      (mockPrisma.notificationDedup.findFirst as jest.Mock).mockResolvedValue({
        id: "dedup-1",
        cacheKey: "profile-123:delivery:completed:order-456",
        createdAt: new Date(),
      });

      const result = await isDuplicateNotificationDistributed(
        "profile-123",
        "delivery:completed",
        "order-456"
      );

      expect(result).toBe(true);
    });

    it("returns false on database error (fail open)", async () => {
      (mockPrisma.notificationDedup.findFirst as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await isDuplicateNotificationDistributed(
        "profile-123",
        "delivery:completed",
        "order-456"
      );

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("markNotificationSentDistributed", () => {
    it("upserts the dedup record", async () => {
      (mockPrisma.notificationDedup.upsert as jest.Mock).mockResolvedValue({
        id: "dedup-1",
        cacheKey: "profile-123:delivery:completed:order-456",
        createdAt: new Date(),
      });

      await markNotificationSentDistributed(
        "profile-123",
        "delivery:completed",
        "order-456"
      );

      expect(mockPrisma.notificationDedup.upsert).toHaveBeenCalledWith({
        where: { cacheKey: "profile-123:delivery:completed:order-456" },
        create: { cacheKey: "profile-123:delivery:completed:order-456" },
        update: { createdAt: expect.any(Date) },
      });
    });

    it("does not throw on database error", async () => {
      (mockPrisma.notificationDedup.upsert as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await expect(
        markNotificationSentDistributed("profile-123", "delivery:completed", "order-456")
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("clearDedupCache", () => {
    it("deletes all dedup records", async () => {
      (mockPrisma.notificationDedup.deleteMany as jest.Mock).mockResolvedValue({
        count: 10,
      });

      await clearDedupCache();

      expect(mockPrisma.notificationDedup.deleteMany).toHaveBeenCalledWith({});
    });
  });

  describe("getDedupTTLSeconds", () => {
    it("returns the configured TTL", () => {
      const ttl = getDedupTTLSeconds();
      expect(ttl).toBe(60);
    });
  });
});
