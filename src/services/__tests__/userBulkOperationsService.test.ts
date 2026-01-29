/**
 * Unit Tests for UserBulkOperationsService
 *
 * Tests for:
 * - bulkStatusChange with transactions
 * - bulkSoftDelete with active order checking
 * - bulkRestore for deleted users
 * - exportUsersToCSV format validation
 */

import { UserBulkOperationsService } from "@/services/userBulkOperationsService";
import { UserStatus, UserType } from "@/types/prisma";

// Mock Prisma types
jest.mock("@prisma/client", () => ({
  Prisma: {
    JsonNull: Symbol("JsonNull"),
  },
  PrismaClient: jest.fn(),
}));

// Mock Prisma
const mockProfileFindUnique = jest.fn();
const mockProfileUpdate = jest.fn();
const mockProfileFindMany = jest.fn();
const mockProfileFindFirst = jest.fn();
const mockProfileCreate = jest.fn();
const mockCateringCount = jest.fn();
const mockOnDemandCount = jest.fn();
const mockUserAuditCreate = jest.fn();
const mockTransaction = jest.fn();

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    profile: {
      findUnique: (...args: unknown[]) => mockProfileFindUnique(...args),
      update: (...args: unknown[]) => mockProfileUpdate(...args),
      findMany: (...args: unknown[]) => mockProfileFindMany(...args),
      findFirst: (...args: unknown[]) => mockProfileFindFirst(...args),
      create: (...args: unknown[]) => mockProfileCreate(...args),
    },
    cateringRequest: {
      count: (...args: unknown[]) => mockCateringCount(...args),
    },
    onDemand: {
      count: (...args: unknown[]) => mockOnDemandCount(...args),
    },
    userAudit: {
      create: (...args: unknown[]) => mockUserAuditCreate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// Mock audit service
jest.mock("@/services/userAuditService", () => ({
  UserAuditService: jest.fn().mockImplementation(() => ({
    createAuditEntry: jest.fn(),
  })),
}));

describe("UserBulkOperationsService", () => {
  let service: UserBulkOperationsService;

  beforeEach(() => {
    service = new UserBulkOperationsService();
    jest.clearAllMocks();

    // Default mock implementations
    mockCateringCount.mockResolvedValue(0);
    mockOnDemandCount.mockResolvedValue(0);
    mockProfileFindFirst.mockResolvedValue(null);
    mockTransaction.mockImplementation((callback) =>
      callback({
        profile: {
          update: mockProfileUpdate,
          create: mockProfileCreate,
          findFirst: mockProfileFindFirst,
        },
        userAudit: { create: mockUserAuditCreate },
      })
    );
  });

  describe("Service Initialization", () => {
    it("should create an instance of UserBulkOperationsService", () => {
      expect(service).toBeInstanceOf(UserBulkOperationsService);
    });

    it("should have all required methods", () => {
      expect(typeof service.bulkStatusChange).toBe("function");
      expect(typeof service.bulkSoftDelete).toBe("function");
      expect(typeof service.bulkRestore).toBe("function");
      expect(typeof service.exportUsersToCSV).toBe("function");
    });
  });

  describe("bulkStatusChange", () => {
    it("should successfully change status for valid users", async () => {
      mockProfileFindUnique
        .mockResolvedValueOnce({
          id: "user-1",
          type: UserType.CLIENT,
          deletedAt: null,
        })
        .mockResolvedValueOnce({ status: UserStatus.PENDING });

      const result = await service.bulkStatusChange(
        { userIds: ["user-1"], status: UserStatus.ACTIVE },
        "admin-1"
      );

      expect(result.totalSuccess).toBe(1);
      expect(result.success).toContain("user-1");
      expect(result.totalFailed).toBe(0);
    });

    it("should reject SUPER_ADMIN users", async () => {
      mockProfileFindUnique.mockResolvedValueOnce({
        id: "user-1",
        type: UserType.SUPER_ADMIN,
        deletedAt: null,
      });

      const result = await service.bulkStatusChange(
        { userIds: ["user-1"], status: UserStatus.ACTIVE },
        "admin-1"
      );

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("Cannot modify Super Admin users");
    });

    it("should skip users with unchanged status", async () => {
      mockProfileFindUnique
        .mockResolvedValueOnce({
          id: "user-1",
          type: UserType.CLIENT,
          deletedAt: null,
        })
        .mockResolvedValueOnce({ status: UserStatus.ACTIVE });

      const result = await service.bulkStatusChange(
        { userIds: ["user-1"], status: UserStatus.ACTIVE },
        "admin-1"
      );

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("Status unchanged");
    });

    it("should handle multiple users", async () => {
      // First user - success
      mockProfileFindUnique
        .mockResolvedValueOnce({
          id: "user-1",
          type: UserType.CLIENT,
          deletedAt: null,
        })
        .mockResolvedValueOnce({ status: UserStatus.PENDING })
        // Second user - SUPER_ADMIN (fail)
        .mockResolvedValueOnce({
          id: "user-2",
          type: UserType.SUPER_ADMIN,
          deletedAt: null,
        })
        // Third user - success
        .mockResolvedValueOnce({
          id: "user-3",
          type: UserType.DRIVER,
          deletedAt: null,
        })
        .mockResolvedValueOnce({ status: UserStatus.PENDING });

      const result = await service.bulkStatusChange(
        { userIds: ["user-1", "user-2", "user-3"], status: UserStatus.ACTIVE },
        "admin-1"
      );

      expect(result.totalProcessed).toBe(3);
      expect(result.totalSuccess).toBe(2);
      expect(result.totalFailed).toBe(1);
    });

    it("should handle user not found", async () => {
      mockProfileFindUnique.mockResolvedValueOnce(null);

      const result = await service.bulkStatusChange(
        { userIds: ["nonexistent-user"], status: UserStatus.ACTIVE },
        "admin-1"
      );

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("User not found");
    });
  });

  describe("bulkSoftDelete", () => {
    it("should successfully soft delete valid users", async () => {
      mockProfileFindUnique
        .mockResolvedValueOnce({
          id: "user-1",
          type: UserType.CLIENT,
          deletedAt: null,
        })
        .mockResolvedValueOnce({ deletedAt: null });

      const result = await service.bulkSoftDelete(
        { userIds: ["user-1"], reason: "Test deletion" },
        "admin-1"
      );

      expect(result.totalSuccess).toBe(1);
      expect(result.success).toContain("user-1");
    });

    it("should reject users with active orders", async () => {
      mockProfileFindUnique
        .mockResolvedValueOnce({
          id: "user-1",
          type: UserType.CLIENT,
          deletedAt: null,
        })
        .mockResolvedValueOnce({ deletedAt: null });

      mockCateringCount.mockResolvedValueOnce(2);

      const result = await service.bulkSoftDelete(
        { userIds: ["user-1"] },
        "admin-1"
      );

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toContain("active orders");
    });

    it("should reject already deleted users", async () => {
      mockProfileFindUnique
        .mockResolvedValueOnce({
          id: "user-1",
          type: UserType.CLIENT,
          deletedAt: null,
        })
        .mockResolvedValueOnce({ deletedAt: new Date() });

      const result = await service.bulkSoftDelete(
        { userIds: ["user-1"] },
        "admin-1"
      );

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("User already deleted");
    });

    it("should reject SUPER_ADMIN users", async () => {
      mockProfileFindUnique.mockResolvedValueOnce({
        id: "user-1",
        type: UserType.SUPER_ADMIN,
        deletedAt: null,
      });

      const result = await service.bulkSoftDelete(
        { userIds: ["user-1"] },
        "admin-1"
      );

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("Cannot modify Super Admin users");
    });
  });

  describe("bulkRestore", () => {
    it("should successfully restore deleted users", async () => {
      mockProfileFindUnique.mockResolvedValueOnce({
        id: "user-1",
        type: UserType.CLIENT,
        deletedAt: new Date(),
        deletedBy: "admin-1",
        deletionReason: "Test",
      });

      const result = await service.bulkRestore(
        { userIds: ["user-1"] },
        "admin-1"
      );

      expect(result.totalSuccess).toBe(1);
      expect(result.success).toContain("user-1");
    });

    it("should reject users that are not deleted", async () => {
      mockProfileFindUnique.mockResolvedValueOnce({
        id: "user-1",
        type: UserType.CLIENT,
        deletedAt: null,
      });

      const result = await service.bulkRestore(
        { userIds: ["user-1"] },
        "admin-1"
      );

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("User is not deleted");
    });

    it("should handle user not found", async () => {
      mockProfileFindUnique.mockResolvedValueOnce(null);

      const result = await service.bulkRestore(
        { userIds: ["nonexistent-user"] },
        "admin-1"
      );

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("User not found");
    });
  });

  describe("exportUsersToCSV", () => {
    it("should generate valid CSV format", async () => {
      mockProfileFindMany.mockResolvedValueOnce([
        {
          id: "user-1",
          name: "John Doe",
          email: "john@example.com",
          type: UserType.CLIENT,
          status: UserStatus.ACTIVE,
          contactName: "John",
          contactNumber: "1234567890",
          companyName: "Acme Inc",
          website: "https://acme.com",
          street1: "123 Main St",
          street2: "Suite 100",
          city: "New York",
          state: "NY",
          zip: "10001",
          createdAt: new Date("2024-01-01"),
          deletedAt: null,
        },
      ]);

      const csv = await service.exportUsersToCSV({});

      expect(csv).toContain("ID,Name,Email");
      expect(csv).toContain("user-1");
      expect(csv).toContain("John Doe");
      expect(csv).toContain("john@example.com");
    });

    it("should filter by userIds when provided", async () => {
      mockProfileFindMany.mockResolvedValueOnce([]);

      await service.exportUsersToCSV({
        userIds: ["user-1", "user-2"],
      });

      expect(mockProfileFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ["user-1", "user-2"] },
          }),
        })
      );
    });

    it("should filter by status when provided", async () => {
      mockProfileFindMany.mockResolvedValueOnce([]);

      await service.exportUsersToCSV({
        status: UserStatus.ACTIVE,
      });

      expect(mockProfileFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: UserStatus.ACTIVE,
          }),
        })
      );
    });

    it("should exclude deleted users by default", async () => {
      mockProfileFindMany.mockResolvedValueOnce([]);

      await service.exportUsersToCSV({});

      expect(mockProfileFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });

    it("should include deleted users when includeDeleted is true", async () => {
      mockProfileFindMany.mockResolvedValueOnce([]);

      await service.exportUsersToCSV({
        includeDeleted: true,
      });

      expect(mockProfileFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });

    it("should escape special CSV characters", async () => {
      mockProfileFindMany.mockResolvedValueOnce([
        {
          id: "user-1",
          name: "John, Doe", // Contains comma
          email: "john@example.com",
          type: UserType.CLIENT,
          status: UserStatus.ACTIVE,
          contactName: 'Has "Quotes"', // Contains quotes
          contactNumber: "1234567890",
          companyName: "Line\nBreak", // Contains newline
          website: null,
          street1: null,
          street2: null,
          city: null,
          state: null,
          zip: null,
          createdAt: new Date("2024-01-01"),
          deletedAt: null,
        },
      ]);

      const csv = await service.exportUsersToCSV({});

      // Values with special characters should be quoted
      expect(csv).toContain('"John, Doe"');
      expect(csv).toContain('"Has ""Quotes"""');
    });
  });

  describe("error handling", () => {
    it("should catch and report errors for individual users", async () => {
      mockProfileFindUnique.mockRejectedValueOnce(new Error("Database error"));

      const result = await service.bulkStatusChange(
        { userIds: ["user-1"], status: UserStatus.ACTIVE },
        "admin-1"
      );

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("Database error");
    });

    it("should continue processing after individual failures", async () => {
      mockProfileFindUnique
        .mockRejectedValueOnce(new Error("Database error"))
        .mockResolvedValueOnce({
          id: "user-2",
          type: UserType.CLIENT,
          deletedAt: null,
        })
        .mockResolvedValueOnce({ status: UserStatus.PENDING });

      const result = await service.bulkStatusChange(
        { userIds: ["user-1", "user-2"], status: UserStatus.ACTIVE },
        "admin-1"
      );

      expect(result.totalProcessed).toBe(2);
      expect(result.totalFailed).toBe(1);
      expect(result.totalSuccess).toBe(1);
    });
  });

  // ============================================================================
  // Phase 3-4 Tests: Role Change, Import, and Email
  // ============================================================================

  describe("bulkRoleChange", () => {
    it("should successfully change role for multiple users", async () => {
      mockProfileFindUnique
        .mockResolvedValueOnce({
          id: "user-1",
          type: UserType.CLIENT,
          deletedAt: null,
        })
        .mockResolvedValueOnce({ type: UserType.CLIENT })
        .mockResolvedValueOnce({
          id: "user-2",
          type: UserType.VENDOR,
          deletedAt: null,
        })
        .mockResolvedValueOnce({ type: UserType.VENDOR });

      const result = await service.bulkRoleChange(
        { userIds: ["user-1", "user-2"], newRole: UserType.DRIVER },
        "admin-1"
      );

      expect(result.totalSuccess).toBe(2);
      expect(result.success).toContain("user-1");
      expect(result.success).toContain("user-2");
      expect(result.totalFailed).toBe(0);
    });

    it("should reject SUPER_ADMIN users from role changes", async () => {
      mockProfileFindUnique.mockResolvedValueOnce({
        id: "user-1",
        type: UserType.SUPER_ADMIN,
        deletedAt: null,
      });

      const result = await service.bulkRoleChange(
        { userIds: ["user-1"], newRole: UserType.CLIENT },
        "admin-1"
      );

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("Cannot modify Super Admin users");
    });

    it("should skip users with unchanged role", async () => {
      mockProfileFindUnique
        .mockResolvedValueOnce({
          id: "user-1",
          type: UserType.CLIENT,
          deletedAt: null,
        })
        .mockResolvedValueOnce({ type: UserType.CLIENT });

      const result = await service.bulkRoleChange(
        { userIds: ["user-1"], newRole: UserType.CLIENT },
        "admin-1"
      );

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("Role unchanged");
    });

    it("should handle user not found", async () => {
      mockProfileFindUnique.mockResolvedValueOnce(null);

      const result = await service.bulkRoleChange(
        { userIds: ["nonexistent-user"], newRole: UserType.DRIVER },
        "admin-1"
      );

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("User not found");
    });

    it("should handle mixed success and failure", async () => {
      // User 1: success
      mockProfileFindUnique
        .mockResolvedValueOnce({
          id: "user-1",
          type: UserType.CLIENT,
          deletedAt: null,
        })
        .mockResolvedValueOnce({ type: UserType.CLIENT })
        // User 2: SUPER_ADMIN (fail)
        .mockResolvedValueOnce({
          id: "user-2",
          type: UserType.SUPER_ADMIN,
          deletedAt: null,
        })
        // User 3: success
        .mockResolvedValueOnce({
          id: "user-3",
          type: UserType.VENDOR,
          deletedAt: null,
        })
        .mockResolvedValueOnce({ type: UserType.VENDOR });

      const result = await service.bulkRoleChange(
        { userIds: ["user-1", "user-2", "user-3"], newRole: UserType.DRIVER },
        "admin-1"
      );

      expect(result.totalProcessed).toBe(3);
      expect(result.totalSuccess).toBe(2);
      expect(result.totalFailed).toBe(1);
    });
  });

  describe("bulkImportUsers", () => {
    it("should parse valid CSV and create users", async () => {
      const csvContent = `Email,Name,Type,Status,Contact Name,Contact Number,Company Name,Website,Street 1,Street 2,City,State,ZIP
john@example.com,John Doe,CLIENT,ACTIVE,John,555-1234,Acme Inc,https://acme.com,123 Main St,Suite 100,New York,NY,10001`;

      mockProfileFindFirst.mockResolvedValue(null); // No existing user
      mockProfileCreate.mockResolvedValue({ id: "new-user-1" });

      const result = await service.bulkImportUsers(csvContent, "admin-1");

      expect(result.totalSuccess).toBe(1);
      expect(result.totalFailed).toBe(0);
    });

    it("should reject rows with missing required email", async () => {
      const csvContent = `Email,Name,Type,Status
,John Doe,CLIENT,ACTIVE`;

      const result = await service.bulkImportUsers(csvContent, "admin-1");

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("Email is required");
    });

    it("should reject rows with invalid email format", async () => {
      const csvContent = `Email,Name,Type,Status
invalid-email,John Doe,CLIENT,ACTIVE`;

      const result = await service.bulkImportUsers(csvContent, "admin-1");

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("Invalid email format");
    });

    it("should handle duplicate emails", async () => {
      const csvContent = `Email,Name,Type,Status
john@example.com,John Doe,CLIENT,ACTIVE`;

      mockProfileFindFirst.mockResolvedValue({ id: "existing-user", deletedAt: null });

      const result = await service.bulkImportUsers(csvContent, "admin-1");

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("Email already exists");
    });

    it("should reject invalid UserType values", async () => {
      const csvContent = `Email,Name,Type,Status
john@example.com,John Doe,INVALID_TYPE,ACTIVE`;

      mockProfileFindFirst.mockResolvedValue(null);

      const result = await service.bulkImportUsers(csvContent, "admin-1");

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toContain("Invalid type");
    });

    it("should reject invalid UserStatus values", async () => {
      const csvContent = `Email,Name,Type,Status
john@example.com,John Doe,CLIENT,INVALID_STATUS`;

      mockProfileFindFirst.mockResolvedValue(null);

      const result = await service.bulkImportUsers(csvContent, "admin-1");

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toContain("Invalid status");
    });

    it("should accumulate row-level errors in failed array", async () => {
      const csvContent = `Email,Name,Type,Status
,John Doe,CLIENT,ACTIVE
invalid-email,Jane,CLIENT,ACTIVE
john@example.com,John,SUPER_ADMIN,ACTIVE`;

      mockProfileFindFirst.mockResolvedValue(null);

      const result = await service.bulkImportUsers(csvContent, "admin-1");

      expect(result.totalFailed).toBe(3);
      expect(result.failed[0].reason).toBe("Email is required");
      expect(result.failed[1].reason).toBe("Invalid email format");
      expect(result.failed[2].reason).toContain("Invalid type");
    });

    it("should handle empty CSV content", async () => {
      const csvContent = "";

      const result = await service.bulkImportUsers(csvContent, "admin-1");

      expect(result.totalProcessed).toBe(0);
      expect(result.totalSuccess).toBe(0);
      expect(result.totalFailed).toBe(0);
    });

    it("should reject SUPER_ADMIN type during import", async () => {
      const csvContent = `Email,Name,Type,Status
admin@example.com,Admin User,SUPER_ADMIN,ACTIVE`;

      mockProfileFindFirst.mockResolvedValue(null);

      const result = await service.bulkImportUsers(csvContent, "admin-1");

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toContain("Invalid type");
    });

    it("should handle deleted user with same email", async () => {
      const csvContent = `Email,Name,Type,Status
john@example.com,John Doe,CLIENT,ACTIVE`;

      mockProfileFindFirst.mockResolvedValue({ id: "deleted-user", deletedAt: new Date() });

      const result = await service.bulkImportUsers(csvContent, "admin-1");

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("User exists (deleted)");
    });
  });

  describe("bulkSendEmail", () => {
    it("should send email to multiple users successfully", async () => {
      mockProfileFindMany.mockResolvedValue([
        { id: "user-1", email: "user1@example.com", name: "User 1" },
        { id: "user-2", email: "user2@example.com", name: "User 2" },
      ]);

      const result = await service.bulkSendEmail(
        {
          userIds: ["user-1", "user-2"],
          template: "announcement",
          subject: "Test Subject",
          body: "Test Body",
        },
        "admin-1"
      );

      expect(result.totalSuccess).toBe(2);
      expect(result.success).toContain("user-1");
      expect(result.success).toContain("user-2");
    });

    it("should skip users without email address", async () => {
      mockProfileFindMany.mockResolvedValue([
        { id: "user-1", email: "user1@example.com", name: "User 1" },
        // user-2 not returned because it has no email
      ]);

      const result = await service.bulkSendEmail(
        {
          userIds: ["user-1", "user-2"],
          template: "promotion",
          subject: "Test Subject",
          body: "Test Body",
        },
        "admin-1"
      );

      expect(result.totalSuccess).toBe(1);
      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("User not found or no email");
    });

    it("should handle user not found", async () => {
      mockProfileFindMany.mockResolvedValue([]);

      const result = await service.bulkSendEmail(
        {
          userIds: ["nonexistent-user"],
          template: "survey",
          subject: "Test Subject",
          body: "Test Body",
        },
        "admin-1"
      );

      expect(result.totalFailed).toBe(1);
      expect(result.failed[0].reason).toBe("User not found or no email");
    });

    it("should handle mixed success and failure", async () => {
      mockProfileFindMany.mockResolvedValue([
        { id: "user-1", email: "user1@example.com", name: "User 1" },
        { id: "user-3", email: "user3@example.com", name: "User 3" },
      ]);

      const result = await service.bulkSendEmail(
        {
          userIds: ["user-1", "user-2", "user-3"],
          template: "custom",
          subject: "Custom Email",
          body: "Custom Body",
        },
        "admin-1"
      );

      expect(result.totalProcessed).toBe(3);
      expect(result.totalSuccess).toBe(2);
      expect(result.totalFailed).toBe(1);
      expect(result.success).toContain("user-1");
      expect(result.success).toContain("user-3");
      expect(result.failed[0].id).toBe("user-2");
    });
  });
});
