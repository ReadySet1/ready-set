/**
 * Tests for the FCM token refresh service.
 */

import {
  recordTokenRefresh,
  getStaleTokens,
  validateToken,
  revokeToken,
  cleanupRevokedTokens,
  getProfileTokenStats,
} from "../token-refresh";

// Mock Prisma
jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    profilePushToken: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    profile: {
      count: jest.fn(),
    },
  },
}));

// Mock Firebase
jest.mock("@/lib/firebase-admin", () => ({
  getFirebaseMessaging: jest.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { getFirebaseMessaging } from "@/lib/firebase-admin";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetFirebaseMessaging = getFirebaseMessaging as jest.Mock;

describe("token refresh service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("recordTokenRefresh", () => {
    it("creates a new token record when token does not exist", async () => {
      (mockPrisma.profilePushToken.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.profilePushToken.create as jest.Mock).mockResolvedValue({
        id: "token-1",
        token: "test-token",
        profileId: "profile-123",
      });

      const result = await recordTokenRefresh(
        "test-token",
        "profile-123",
        "Mozilla/5.0",
        "web"
      );

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(true);
      expect(mockPrisma.profilePushToken.create).toHaveBeenCalledWith({
        data: {
          profileId: "profile-123",
          token: "test-token",
          userAgent: "Mozilla/5.0",
          platform: "web",
          lastRefreshedAt: expect.any(Date),
          refreshCount: 0,
        },
      });
    });

    it("updates existing token with refresh tracking", async () => {
      (mockPrisma.profilePushToken.findUnique as jest.Mock).mockResolvedValue({
        id: "token-1",
        token: "test-token",
        profileId: "profile-123",
        refreshCount: 5,
      });
      (mockPrisma.profilePushToken.update as jest.Mock).mockResolvedValue({
        id: "token-1",
        refreshCount: 6,
      });

      const result = await recordTokenRefresh(
        "test-token",
        "profile-123",
        "Mozilla/5.0",
        "web"
      );

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(false);
      expect(mockPrisma.profilePushToken.update).toHaveBeenCalledWith({
        where: { token: "test-token" },
        data: {
          profileId: "profile-123",
          userAgent: "Mozilla/5.0",
          platform: "web",
          lastRefreshedAt: expect.any(Date),
          refreshCount: { increment: 1 },
          revokedAt: null,
        },
      });
    });

    it("returns error on database failure", async () => {
      (mockPrisma.profilePushToken.findUnique as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await recordTokenRefresh("test-token", "profile-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");

      consoleSpy.mockRestore();
    });
  });

  describe("getStaleTokens", () => {
    it("returns tokens not refreshed recently", async () => {
      const staleTokens = [
        {
          id: "token-1",
          profileId: "profile-1",
          token: "stale-token-1",
          lastRefreshedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        },
      ];

      (mockPrisma.profilePushToken.findMany as jest.Mock).mockResolvedValue(staleTokens);

      const result = await getStaleTokens(100);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("token-1");
      expect(result[0].daysSinceRefresh).toBeGreaterThanOrEqual(59);
    });

    it("returns empty array on error", async () => {
      (mockPrisma.profilePushToken.findMany as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await getStaleTokens(100);

      expect(result).toEqual([]);

      consoleSpy.mockRestore();
    });
  });

  describe("validateToken", () => {
    it("returns valid when Firebase messaging unavailable", async () => {
      mockGetFirebaseMessaging.mockReturnValue(null);

      const result = await validateToken("test-token");

      expect(result.valid).toBe(true);
      expect(result.error).toBe("Firebase Messaging not available");
    });

    it("returns valid when dry run succeeds", async () => {
      const mockMessaging = {
        send: jest.fn().mockResolvedValue("message-id"),
      };
      mockGetFirebaseMessaging.mockReturnValue(mockMessaging);

      const result = await validateToken("test-token");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("returns invalid for unregistered token errors", async () => {
      const mockMessaging = {
        send: jest.fn().mockRejectedValue(
          new Error("messaging/registration-token-not-registered")
        ),
      };
      mockGetFirebaseMessaging.mockReturnValue(mockMessaging);

      const result = await validateToken("test-token");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("registration-token-not-registered");
    });
  });

  describe("revokeToken", () => {
    it("updates token with revoked timestamp", async () => {
      (mockPrisma.profilePushToken.update as jest.Mock).mockResolvedValue({
        id: "token-1",
        revokedAt: new Date(),
      });

      const consoleSpy = jest.spyOn(console, "info").mockImplementation();

      const result = await revokeToken("token-1", "Token expired");

      expect(result).toBe(true);
      expect(mockPrisma.profilePushToken.update).toHaveBeenCalledWith({
        where: { id: "token-1" },
        data: { revokedAt: expect.any(Date) },
      });

      consoleSpy.mockRestore();
    });

    it("returns false on error", async () => {
      (mockPrisma.profilePushToken.update as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await revokeToken("token-1");

      expect(result).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe("cleanupRevokedTokens", () => {
    it("deletes revoked tokens older than retention period", async () => {
      (mockPrisma.profilePushToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 25,
      });

      const count = await cleanupRevokedTokens(7);

      expect(count).toBe(25);
      expect(mockPrisma.profilePushToken.deleteMany).toHaveBeenCalledWith({
        where: {
          revokedAt: {
            not: null,
            lt: expect.any(Date),
          },
        },
      });
    });
  });

  describe("getProfileTokenStats", () => {
    it("returns token statistics for a profile", async () => {
      (mockPrisma.profilePushToken.count as jest.Mock)
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(3) // active
        .mockResolvedValueOnce(2) // revoked
        .mockResolvedValueOnce(1); // stale

      const stats = await getProfileTokenStats("profile-123");

      expect(stats).toEqual({
        totalTokens: 5,
        activeTokens: 3,
        revokedTokens: 2,
        staleTokens: 1,
      });
    });
  });
});
