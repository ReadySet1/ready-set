/**
 * Unit Tests for UserAuditService
 *
 * Tests for:
 * - getAuditLogs with pagination and filtering
 * - exportAuditLogsCSV generation
 * - createAuditEntry with transaction support
 * - getChangedFields comparison logic
 * - sanitizeForAudit field filtering
 */

import { UserAuditService } from "@/services/userAuditService";
import { AuditAction } from "@/types/audit";

// Mock Prisma types
jest.mock("@prisma/client", () => ({
  Prisma: {
    JsonNull: Symbol("JsonNull"),
  },
  PrismaClient: jest.fn(),
}));

// Mock Prisma
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockGroupBy = jest.fn();
const mockFindFirst = jest.fn();

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    userAudit: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    profile: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock("@/utils/logger", () => ({
  loggers: {
    prisma: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    },
  },
}));

describe("UserAuditService", () => {
  let userAuditService: UserAuditService;

  beforeEach(() => {
    userAuditService = new UserAuditService();
    jest.clearAllMocks();
  });

  describe("Service Initialization", () => {
    it("should create an instance of UserAuditService", () => {
      expect(userAuditService).toBeInstanceOf(UserAuditService);
    });

    it("should have all required methods", () => {
      expect(typeof userAuditService.getAuditLogs).toBe("function");
      expect(typeof userAuditService.exportAuditLogsCSV).toBe("function");
      expect(typeof userAuditService.createAuditEntry).toBe("function");
      expect(typeof userAuditService.logAuditEntry).toBe("function");
      expect(typeof userAuditService.getAuditSummary).toBe("function");
    });

    it("should have static utility methods", () => {
      expect(typeof UserAuditService.getChangedFields).toBe("function");
      expect(typeof UserAuditService.sanitizeForAudit).toBe("function");
    });
  });

  describe("getAuditLogs", () => {
    const mockAuditLogs = [
      {
        id: "audit-1",
        userId: "user-123",
        action: "UPDATE" as const,
        changes: { before: { name: "Old" }, after: { name: "New" } },
        performedBy: "admin-1",
        reason: "Profile update",
        createdAt: new Date("2024-01-15T10:00:00Z"),
        metadata: null,
        performer: {
          id: "admin-1",
          name: "Admin User",
          email: "admin@test.com",
          image: null,
        },
      },
      {
        id: "audit-2",
        userId: "user-123",
        action: "ROLE_CHANGE" as const,
        changes: { before: { type: "client" }, after: { type: "vendor" } },
        performedBy: "admin-1",
        reason: "User requested role change",
        createdAt: new Date("2024-01-14T10:00:00Z"),
        metadata: null,
        performer: {
          id: "admin-1",
          name: "Admin User",
          email: "admin@test.com",
          image: null,
        },
      },
    ];

    it("should return paginated audit logs", async () => {
      mockFindMany
        .mockResolvedValueOnce(mockAuditLogs)
        .mockResolvedValueOnce([{ action: "UPDATE" }, { action: "ROLE_CHANGE" }]);
      mockCount.mockResolvedValue(2);

      const result = await userAuditService.getAuditLogs({ userId: "user-123" });

      expect(result.logs).toHaveLength(2);
      expect(result.pagination.totalCount).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPrevPage).toBe(false);
    });

    it("should apply action filter", async () => {
      mockFindMany
        .mockResolvedValueOnce([mockAuditLogs[0]])
        .mockResolvedValueOnce([{ action: "UPDATE" }]);
      mockCount.mockResolvedValue(1);

      await userAuditService.getAuditLogs({
        userId: "user-123",
        actions: [AuditAction.UPDATE],
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user-123",
            action: { in: ["UPDATE"] },
          }),
        })
      );
    });

    it("should apply date range filters", async () => {
      mockFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockCount.mockResolvedValue(0);

      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-31T23:59:59Z");

      await userAuditService.getAuditLogs({
        userId: "user-123",
        startDate,
        endDate,
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user-123",
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });

    it("should handle pagination correctly", async () => {
      mockFindMany
        .mockResolvedValueOnce(mockAuditLogs)
        .mockResolvedValueOnce([{ action: "UPDATE" }]);
      mockCount.mockResolvedValue(50);

      const result = await userAuditService.getAuditLogs({
        userId: "user-123",
        page: 2,
        limit: 10,
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPrevPage).toBe(true);
    });

    it("should return available actions for filtering", async () => {
      mockFindMany
        .mockResolvedValueOnce(mockAuditLogs)
        .mockResolvedValueOnce([
          { action: "UPDATE" },
          { action: "ROLE_CHANGE" },
          { action: "STATUS_CHANGE" },
        ]);
      mockCount.mockResolvedValue(2);

      const result = await userAuditService.getAuditLogs({ userId: "user-123" });

      expect(result.filters.availableActions).toContain("UPDATE");
      expect(result.filters.availableActions).toContain("ROLE_CHANGE");
      expect(result.filters.availableActions).toContain("STATUS_CHANGE");
    });
  });

  describe("exportAuditLogsCSV", () => {
    const mockAuditLogs = [
      {
        id: "audit-1",
        userId: "user-123",
        action: "UPDATE" as const,
        changes: { before: { name: "Old" }, after: { name: "New" } },
        performedBy: "admin-1",
        reason: "Profile update",
        createdAt: new Date("2024-01-15T10:00:00Z"),
        performer: {
          name: "Admin User",
          email: "admin@test.com",
        },
      },
    ];

    it("should generate CSV with correct headers", async () => {
      mockFindMany.mockResolvedValue(mockAuditLogs);

      const csv = await userAuditService.exportAuditLogsCSV({ userId: "user-123" });

      expect(csv).toContain("Timestamp");
      expect(csv).toContain("Action");
      expect(csv).toContain("Performed By");
      expect(csv).toContain("Email");
      expect(csv).toContain("Field Changed");
      expect(csv).toContain("Before Value");
      expect(csv).toContain("After Value");
      expect(csv).toContain("Reason");
    });

    it("should include audit log data in CSV", async () => {
      mockFindMany.mockResolvedValue(mockAuditLogs);

      const csv = await userAuditService.exportAuditLogsCSV({ userId: "user-123" });

      expect(csv).toContain("UPDATE");
      expect(csv).toContain("Admin User");
      expect(csv).toContain("admin@test.com");
      expect(csv).toContain("Profile update");
      expect(csv).toContain("name");
    });

    it("should handle empty results", async () => {
      mockFindMany.mockResolvedValue([]);

      const csv = await userAuditService.exportAuditLogsCSV({ userId: "user-123" });

      // Should still have headers
      expect(csv).toContain("Timestamp");
      expect(csv).toContain("Action");
    });
  });

  describe("getChangedFields (static)", () => {
    it("should detect changed string fields", () => {
      const before = { name: "John", email: "john@test.com" };
      const after = { name: "Jane", email: "john@test.com" };

      const result = UserAuditService.getChangedFields(before, after);

      expect(result.before).toEqual({ name: "John" });
      expect(result.after).toEqual({ name: "Jane" });
    });

    it("should detect multiple changed fields", () => {
      const before = { name: "John", email: "john@test.com", phone: "123" };
      const after = { name: "Jane", email: "jane@test.com", phone: "123" };

      const result = UserAuditService.getChangedFields(before, after);

      expect(result.before).toEqual({ name: "John", email: "john@test.com" });
      expect(result.after).toEqual({ name: "Jane", email: "jane@test.com" });
    });

    it("should return empty objects if no changes", () => {
      const before = { name: "John", email: "john@test.com" };
      const after = { name: "John", email: "john@test.com" };

      const result = UserAuditService.getChangedFields(before, after);

      expect(result.before).toEqual({});
      expect(result.after).toEqual({});
    });

    it("should handle added fields", () => {
      const before = { name: "John" };
      const after = { name: "John", phone: "123" };

      const result = UserAuditService.getChangedFields(before, after);

      expect(result.before).toEqual({ phone: undefined });
      expect(result.after).toEqual({ phone: "123" });
    });

    it("should handle removed fields (null values)", () => {
      const before = { name: "John", phone: "123" };
      const after = { name: "John", phone: null };

      const result = UserAuditService.getChangedFields(before, after);

      expect(result.before).toEqual({ phone: "123" });
      expect(result.after).toEqual({ phone: null });
    });
  });

  describe("sanitizeForAudit (static)", () => {
    it("should remove sensitive fields", () => {
      const data = {
        name: "John",
        email: "john@test.com",
        password: "secret123",
        passwordHash: "hashedvalue",
        refreshToken: "abc123",
      };

      const result = UserAuditService.sanitizeForAudit(data);

      expect(result.name).toBe("John");
      expect(result.email).toBe("john@test.com");
      expect(result.password).toBeUndefined();
      expect(result.passwordHash).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
    });

    it("should handle empty object", () => {
      const result = UserAuditService.sanitizeForAudit({});
      expect(result).toEqual({});
    });

    it("should preserve non-sensitive fields", () => {
      const data = {
        name: "John",
        type: "client",
        status: "active",
        companyName: "Test Corp",
      };

      const result = UserAuditService.sanitizeForAudit(data);

      expect(result).toEqual(data);
    });
  });

  describe("createAuditEntry (instance method)", () => {
    it("should create audit entry with all parameters", async () => {
      const mockTx = {
        userAudit: {
          create: jest.fn().mockResolvedValue({ id: "new-audit-id" }),
        },
      };

      await userAuditService.createAuditEntry(mockTx as unknown as Parameters<typeof userAuditService.createAuditEntry>[0], {
        userId: "user-123",
        action: AuditAction.UPDATE,
        performedBy: "admin-456",
        before: { name: "Old" },
        after: { name: "New" },
        reason: "Profile update",
      });

      expect(mockTx.userAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-123",
          action: "UPDATE",
          performedBy: "admin-456",
          reason: "Profile update",
        }),
      });
    });

    it("should handle optional reason parameter", async () => {
      const mockTx = {
        userAudit: {
          create: jest.fn().mockResolvedValue({ id: "new-audit-id" }),
        },
      };

      await userAuditService.createAuditEntry(mockTx as unknown as Parameters<typeof userAuditService.createAuditEntry>[0], {
        userId: "user-123",
        action: AuditAction.CREATE,
        performedBy: "admin-456",
        after: { name: "New User" },
      });

      expect(mockTx.userAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-123",
          action: "CREATE",
          performedBy: "admin-456",
          reason: null,
        }),
      });
    });
  });

  describe("getAuditSummary", () => {
    it("should return audit summary with stats", async () => {
      mockCount.mockResolvedValue(10);
      mockGroupBy.mockResolvedValue([
        { action: "UPDATE", _count: { action: 5 } },
        { action: "STATUS_CHANGE", _count: { action: 3 } },
      ]);
      mockFindFirst.mockResolvedValue({
        createdAt: new Date("2024-01-15T10:00:00Z"),
        action: "UPDATE",
      });

      const result = await userAuditService.getAuditSummary("user-123");

      expect(result.totalEntries).toBe(10);
      expect(result.actionCounts).toBeDefined();
      expect(result.lastActivity).toBeDefined();
      expect(result.lastAction).toBe("UPDATE");
    });
  });
});
