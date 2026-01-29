/**
 * API Route Tests for POST /api/users/bulk/email
 *
 * Tests for bulk email endpoint
 */

import { POST } from "../email/route";
import { UserType } from "@/types/prisma";
import { createPostRequest } from "@/__tests__/helpers/api-test-helpers";

// Mock Supabase
const mockGetUser = jest.fn();
jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn().mockImplementation(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
      },
    })
  ),
}));

// Mock Prisma
const mockProfileFindUnique = jest.fn();
jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    profile: {
      findUnique: (...args: unknown[]) => mockProfileFindUnique(...args),
    },
  },
}));

// Mock the bulk operations service
const mockBulkSendEmail = jest.fn();
jest.mock("@/services/userBulkOperationsService", () => ({
  userBulkOperationsService: {
    bulkSendEmail: (...args: unknown[]) => mockBulkSendEmail(...args),
  },
}));

describe("POST /api/users/bulk/email", () => {
  const validUUID1 = "12345678-1234-1234-1234-123456789012";
  const validUUID2 = "87654321-4321-4321-4321-210987654321";
  const adminId = "aaaaaaaa-1234-1234-1234-123456789012";

  const validEmailRequest = {
    userIds: [validUUID1, validUUID2],
    template: "announcement",
    subject: "Test Subject",
    body: "Test email body content",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = createPostRequest(
        "http://localhost:3000/api/users/bulk/email",
        validEmailRequest
      );

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });
  });

  describe("Authorization", () => {
    it("should return 403 when user is not admin", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.CLIENT,
      });

      const req = createPostRequest(
        "http://localhost:3000/api/users/bulk/email",
        validEmailRequest
      );

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("Forbidden");
    });

    it("should allow ADMIN users", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN,
      });
      mockBulkSendEmail.mockResolvedValue({
        success: [validUUID1, validUUID2],
        failed: [],
        totalProcessed: 2,
        totalSuccess: 2,
        totalFailed: 0,
      });

      const req = createPostRequest(
        "http://localhost:3000/api/users/bulk/email",
        validEmailRequest
      );

      const response = await POST(req);

      expect(response.status).toBe(200);
    });

    it("should allow SUPER_ADMIN users", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });
      mockBulkSendEmail.mockResolvedValue({
        success: [validUUID1],
        failed: [],
        totalProcessed: 1,
        totalSuccess: 1,
        totalFailed: 0,
      });

      const req = createPostRequest(
        "http://localhost:3000/api/users/bulk/email",
        validEmailRequest
      );

      const response = await POST(req);

      expect(response.status).toBe(200);
    });
  });

  describe("Request Validation", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN,
      });
    });

    it("should return 400 when userIds is not an array", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/email", {
        ...validEmailRequest,
        userIds: "not-an-array",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("userIds must be a non-empty array");
    });

    it("should return 400 when userIds is empty", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/email", {
        ...validEmailRequest,
        userIds: [],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("userIds must be a non-empty array");
    });

    it("should return 400 when template is invalid", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/email", {
        ...validEmailRequest,
        template: "invalid_template",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid template");
    });

    it("should return 400 when subject is missing", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/email", {
        ...validEmailRequest,
        subject: "",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Subject is required");
    });

    it("should return 400 when subject is too long", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/email", {
        ...validEmailRequest,
        subject: "a".repeat(201),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("200 characters or less");
    });

    it("should return 400 when body is missing", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/email", {
        ...validEmailRequest,
        body: "",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Email body is required");
    });

    it("should return 400 when user ID format is invalid", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/email", {
        ...validEmailRequest,
        userIds: ["invalid-uuid"],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid user ID format");
    });
  });

  describe("Valid Templates", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN,
      });
      mockBulkSendEmail.mockResolvedValue({
        success: [validUUID1],
        failed: [],
        totalProcessed: 1,
        totalSuccess: 1,
        totalFailed: 0,
      });
    });

    it.each(["announcement", "promotion", "survey", "custom"])(
      "should accept %s template",
      async (template) => {
        const req = createPostRequest("http://localhost:3000/api/users/bulk/email", {
          ...validEmailRequest,
          template,
        });

        const response = await POST(req);

        expect(response.status).toBe(200);
      }
    );
  });

  describe("Successful Operations", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN,
      });
    });

    it("should successfully send email to multiple users", async () => {
      mockBulkSendEmail.mockResolvedValue({
        success: [validUUID1, validUUID2],
        failed: [],
        totalProcessed: 2,
        totalSuccess: 2,
        totalFailed: 0,
      });

      const req = createPostRequest(
        "http://localhost:3000/api/users/bulk/email",
        validEmailRequest
      );

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results.totalSuccess).toBe(2);
      expect(data.results.totalFailed).toBe(0);
      expect(mockBulkSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          userIds: [validUUID1, validUUID2],
          template: "announcement",
          subject: "Test Subject",
          body: "Test email body content",
        }),
        adminId
      );
    });

    it("should handle partial failures", async () => {
      mockBulkSendEmail.mockResolvedValue({
        success: [validUUID1],
        failed: [{ id: validUUID2, reason: "No email address" }],
        totalProcessed: 2,
        totalSuccess: 1,
        totalFailed: 1,
      });

      const req = createPostRequest(
        "http://localhost:3000/api/users/bulk/email",
        validEmailRequest
      );

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain("1 users");
      expect(data.message).toContain("1 failed");
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN,
      });
    });

    it("should return 500 when service throws an error", async () => {
      mockBulkSendEmail.mockRejectedValue(new Error("Email service unavailable"));

      const req = createPostRequest(
        "http://localhost:3000/api/users/bulk/email",
        validEmailRequest
      );

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to send bulk email");
      expect(data.details).toBe("Email service unavailable");
    });
  });
});
