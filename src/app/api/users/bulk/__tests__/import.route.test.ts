/**
 * API Route Tests for POST /api/users/bulk/import
 *
 * Tests for bulk user import endpoint
 */

import { POST } from "../import/route";
import { UserType } from "@/types/prisma";
import { NextRequest } from "next/server";

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
const mockBulkImportUsers = jest.fn();
jest.mock("@/services/userBulkOperationsService", () => ({
  userBulkOperationsService: {
    bulkImportUsers: (...args: unknown[]) => mockBulkImportUsers(...args),
  },
}));

// Helper to create a mock file object
interface MockFile {
  name: string;
  type: string;
  size: number;
  text: () => Promise<string>;
}

function createMockFile(content: string, filename: string, mimeType: string): MockFile {
  return {
    name: filename,
    type: mimeType,
    size: content.length,
    text: () => Promise.resolve(content),
  };
}

// Create a request with mocked formData
function createImportRequest(
  file: MockFile | null,
): NextRequest {
  const req = new NextRequest("http://localhost:3000/api/users/bulk/import", {
    method: "POST",
  });

  // Mock the formData method
  req.formData = jest.fn().mockResolvedValue({
    get: (key: string) => (key === "file" ? file : null),
  });

  return req;
}

function createCSVRequest(csvContent: string, filename = "users.csv"): NextRequest {
  const file = createMockFile(csvContent, filename, "text/csv");
  return createImportRequest(file);
}

describe("POST /api/users/bulk/import", () => {
  const adminId = "aaaaaaaa-1234-1234-1234-123456789012";

  const validCSV = `Email,Name,Type,Status,Contact Name,Contact Number,Company Name,Website,Street 1,Street 2,City,State,ZIP
user1@example.com,John Doe,VENDOR,ACTIVE,John,555-1234,Acme Inc,https://acme.com,123 Main St,,Austin,TX,78701
user2@example.com,Jane Smith,CLIENT,PENDING,Jane,555-5678,Tech Corp,,456 Oak Ave,,Houston,TX,77001`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = createCSVRequest(validCSV);

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

      const req = createCSVRequest(validCSV);

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
      mockBulkImportUsers.mockResolvedValue({
        success: ["id1", "id2"],
        failed: [],
        totalProcessed: 2,
        totalSuccess: 2,
        totalFailed: 0,
      });

      const req = createCSVRequest(validCSV);

      const response = await POST(req);

      expect(response.status).toBe(200);
    });
  });

  describe("File Validation", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN,
      });
    });

    it("should return 400 when no file is provided", async () => {
      const req = createImportRequest(null);

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("No file provided");
    });

    it("should return 400 for non-CSV files", async () => {
      const file = createMockFile("not a csv", "test.txt", "text/plain");
      const req = createImportRequest(file);

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("must be a CSV");
    });

    it("should return 400 for empty CSV", async () => {
      const req = createCSVRequest("");

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("empty");
    });

    it("should return 400 for CSV with only headers", async () => {
      const req = createCSVRequest("Email,Name,Type,Status");

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("at least one data row");
    });

    it("should return 400 for CSV missing required headers", async () => {
      const invalidCSV = `Name,Contact
John Doe,555-1234`;

      const req = createCSVRequest(invalidCSV);

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing required headers");
    });
  });

  describe("Successful Import", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN,
      });
    });

    it("should successfully import users", async () => {
      mockBulkImportUsers.mockResolvedValue({
        success: ["id1", "id2"],
        failed: [],
        totalProcessed: 2,
        totalSuccess: 2,
        totalFailed: 0,
      });

      const req = createCSVRequest(validCSV);

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary.totalSuccess).toBe(2);
      expect(data.summary.totalFailed).toBe(0);
      expect(data.results.success).toHaveLength(2);
    });

    it("should handle partial failures", async () => {
      mockBulkImportUsers.mockResolvedValue({
        success: ["id1"],
        failed: [{ row: 3, email: "user2@example.com", reason: "Email already exists" }],
        totalProcessed: 2,
        totalSuccess: 1,
        totalFailed: 1,
      });

      const req = createCSVRequest(validCSV);

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary.totalSuccess).toBe(1);
      expect(data.summary.totalFailed).toBe(1);
      expect(data.results.failed).toHaveLength(1);
      expect(data.results.failed[0].email).toBe("user2@example.com");
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
      mockBulkImportUsers.mockRejectedValue(new Error("Database error"));

      const req = createCSVRequest(validCSV);

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to import users");
    });
  });
});
