/**
 * Tests for /api/register route
 *
 * This route is CRITICAL as it handles complete user registration with:
 * - Multiple user types (vendor, client, driver, helpdesk)
 * - Supabase auth integration
 * - Prisma profile creation
 * - Address creation and linking
 * - Welcome email sending
 *
 * Tests cover:
 * - Input validation for all user types
 * - Duplicate detection
 * - Supabase/Prisma integration
 * - Error handling
 */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { sendUserWelcomeEmail } from "@/services/email-notification";
import {
  createPostRequest,
  expectSuccessResponse,
  expectValidationError,
  expectErrorResponse,
  expectServerError,
} from "@/__tests__/helpers/api-test-helpers";

// Mock dependencies
jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    address: {
      create: jest.fn(),
    },
    userAddress: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/services/email-notification", () => ({
  sendUserWelcomeEmail: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockPrisma = prisma as any;
const mockSendEmail = sendUserWelcomeEmail as jest.MockedFunction<typeof sendUserWelcomeEmail>;

describe("/api/register", () => {
  const validVendorData = {
    email: "vendor@example.com",
    password: "SecurePassword123!",
    phoneNumber: "555-0100",
    userType: "vendor",
    company: "Test Vendor Inc",
    contact_name: "John Vendor",
    timeNeeded: ["Morning", "Afternoon"],
    frequency: "Weekly",
    street1: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    countiesServed: ["San Francisco", "Alameda"],
    parking: "Street parking available",
    website: "https://testvendor.com",
  };

  const validClientData = {
    email: "client@example.com",
    password: "SecurePassword123!",
    phoneNumber: "555-0200",
    userType: "client",
    company: "Test Client Corp",
    contact_name: "Jane Client",
    timeNeeded: ["Lunch"],
    frequency: "Daily",
    countiesServed: ["San Francisco"],
    head_count: "50",
    street1: "456 Market St",
    city: "San Francisco",
    state: "CA",
    zip: "94103",
  };

  const validDriverData = {
    email: "driver@example.com",
    password: "SecurePassword123!",
    phoneNumber: "555-0300",
    userType: "driver",
    name: "Bob Driver",
    street1: "789 Oak St",
    city: "Oakland",
    state: "CA",
    zip: "94601",
  };

  const mockSupabaseUser = {
    id: "new-user-id",
    email: "test@example.com",
  };

  const mockProfile = {
    id: "new-user-id",
    email: "test@example.com",
    name: "Test User",
  };

  const mockAddress = {
    id: "address-id",
    street1: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: no existing user
    mockPrisma.profile.findUnique.mockResolvedValue(null);

    // Default: successful Supabase signup
    mockCreateClient.mockResolvedValue({
      auth: {
        signUp: jest.fn().mockResolvedValue({
          data: { user: mockSupabaseUser },
          error: null,
        }),
      },
    } as any);

    // Default: successful Prisma operations
    mockPrisma.profile.create.mockResolvedValue(mockProfile);
    mockPrisma.address.create.mockResolvedValue(mockAddress);
    mockPrisma.userAddress.create.mockResolvedValue({
      userId: mockProfile.id,
      addressId: mockAddress.id,
    });

    // Default: successful email sending
    mockSendEmail.mockResolvedValue(true);
  });

  describe("POST /api/register - Vendor Registration", () => {
    it("should successfully register a vendor user", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/register",
        validVendorData
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.message).toContain("User created successfully");
      expect(data.userId).toBe(mockSupabaseUser.id);
      expect(data.emailSent).toBe(true);
    });

    it("should require all vendor-specific fields", async () => {
      const { company, ...dataWithoutCompany } = validVendorData;

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithoutCompany
      );

      const response = await POST(request);
      const data = await expectValidationError(response);

      expect(data.missingFields).toContain("company");
    });

    it("should require contact_name for vendors", async () => {
      const { contact_name, ...dataWithoutContactName } = validVendorData;

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithoutContactName
      );

      const response = await POST(request);
      await expectValidationError(response);
    });

    it("should require timeNeeded for vendors", async () => {
      const { timeNeeded, ...dataWithoutTimeNeeded } = validVendorData;

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithoutTimeNeeded
      );

      const response = await POST(request);
      await expectValidationError(response);
    });

    it("should require frequency for vendors", async () => {
      const { frequency, ...dataWithoutFrequency } = validVendorData;

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithoutFrequency
      );

      const response = await POST(request);
      await expectValidationError(response);
    });
  });

  describe("POST /api/register - Client Registration", () => {
    it("should successfully register a client user", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/register",
        validClientData
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.message).toContain("User created successfully");
    });

    it("should require countiesServed for clients", async () => {
      const { countiesServed, ...dataWithoutCounties } = validClientData;

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithoutCounties
      );

      const response = await POST(request);
      const data = await expectValidationError(response);

      expect(data.missingFields).toContain("countiesServed");
    });

    it("should require head_count for clients", async () => {
      const { head_count, ...dataWithoutHeadCount} = validClientData;

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithoutHeadCount
      );

      const response = await POST(request);
      const data = await expectValidationError(response);

      expect(data.missingFields).toContain("head_count");
    });
  });

  describe("POST /api/register - Driver Registration", () => {
    it("should successfully register a driver user", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/register",
        validDriverData
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.message).toContain("User created successfully");
    });

    it("should require name for drivers", async () => {
      const { name, ...dataWithoutName } = validDriverData;

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithoutName
      );

      const response = await POST(request);
      const data = await expectValidationError(response);

      expect(data.missingFields).toContain("name");
    });
  });

  describe("POST /api/register - Common Validation", () => {
    it("should require email field", async () => {
      const { email, ...dataWithoutEmail } = validVendorData;

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithoutEmail
      );

      const response = await POST(request);
      const data = await expectValidationError(response);

      expect(data.missingFields).toContain("email");
    });

    it("should validate email format", async () => {
      const dataWithInvalidEmail = {
        ...validVendorData,
        email: "not-an-email",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithInvalidEmail
      );

      const response = await POST(request);
      const data = await expectErrorResponse(response, 400);

      expect(data.error).toContain("Invalid email format");
    });

    it("should require password field", async () => {
      const { password, ...dataWithoutPassword } = validVendorData;

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithoutPassword
      );

      const response = await POST(request);
      const data = await expectValidationError(response);

      expect(data.missingFields).toContain("password");
    });

    it("should validate password length (minimum 8 characters)", async () => {
      const dataWithShortPassword = {
        ...validVendorData,
        password: "short",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithShortPassword
      );

      const response = await POST(request);
      const data = await expectErrorResponse(response, 400);

      expect(data.error).toContain("Password must be at least 8 characters");
    });

    it("should require phoneNumber field", async () => {
      const { phoneNumber, ...dataWithoutPhone } = validVendorData;

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithoutPhone
      );

      const response = await POST(request);
      const data = await expectValidationError(response);

      expect(data.missingFields).toContain("phoneNumber");
    });

    it("should require userType field", async () => {
      const { userType, ...dataWithoutUserType } = validVendorData;

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithoutUserType
      );

      const response = await POST(request);
      const data = await expectValidationError(response);

      expect(data.missingFields).toContain("userType");
    });

    it("should require address fields (street1, city, state, zip)", async () => {
      const { street1, city, state, zip, ...dataWithoutAddress } = validVendorData;

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithoutAddress
      );

      const response = await POST(request);
      const data = await expectValidationError(response);

      expect(data.missingFields).toContain("street1");
      expect(data.missingFields).toContain("city");
      expect(data.missingFields).toContain("state");
      expect(data.missingFields).toContain("zip");
    });
  });

  describe("POST /api/register - Duplicate Detection", () => {
    it("should reject duplicate email in Prisma", async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        id: "existing-user-id",
        email: validVendorData.email.toLowerCase(),
      });

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        validVendorData
      );

      const response = await POST(request);
      const data = await expectErrorResponse(response, 400);

      expect(data.error).toContain("User already exists");
    });

    it("should handle Supabase duplicate user error", async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          signUp: jest.fn().mockResolvedValue({
            data: { user: null },
            error: {
              message: "User already registered",
              status: 422,
            },
          }),
        },
      } as any);

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        validVendorData
      );

      const response = await POST(request);
      const data = await expectErrorResponse(response, 400);

      expect(data.error).toContain("Account found");
    });

    it("should normalize email to lowercase for duplicate check", async () => {
      const dataWithUppercaseEmail = {
        ...validVendorData,
        email: "VENDOR@EXAMPLE.COM",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        dataWithUppercaseEmail
      );

      await POST(request);

      // Verify Prisma was queried with lowercase email
      expect(mockPrisma.profile.findUnique).toHaveBeenCalledWith({
        where: {
          email: "vendor@example.com",
        },
      });
    });
  });

  describe("POST /api/register - Supabase Integration", () => {
    it("should create user in Supabase with correct metadata", async () => {
      const mockSignUp = jest.fn().mockResolvedValue({
        data: { user: mockSupabaseUser },
        error: null,
      });

      mockCreateClient.mockResolvedValue({
        auth: {
          signUp: mockSignUp,
        },
      } as any);

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        validVendorData
      );

      await POST(request);

      // Verify signUp was called with correct parameters
      expect(mockSignUp).toHaveBeenCalledWith({
        email: validVendorData.email.toLowerCase(),
        password: validVendorData.password,
        options: expect.objectContaining({
          data: expect.objectContaining({
            userType: "VENDOR",
            name: validVendorData.contact_name,
            company: validVendorData.company,
          }),
        }),
      });
    });

    it("should handle Supabase auth errors", async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          signUp: jest.fn().mockResolvedValue({
            data: { user: null },
            error: {
              message: "Invalid credentials",
              status: 500,
            },
          }),
        },
      } as any);

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        validVendorData
      );

      const response = await POST(request);
      await expectServerError(response);
    });
  });

  describe("POST /api/register - Prisma Integration", () => {
    it("should create profile with correct data for vendor", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/register",
        validVendorData
      );

      await POST(request);

      // Verify profile creation
      expect(mockPrisma.profile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: mockSupabaseUser.id,
          email: validVendorData.email.toLowerCase(),
          contactNumber: validVendorData.phoneNumber,
          type: "VENDOR",
          name: validVendorData.contact_name,
          companyName: validVendorData.company,
        }),
      });
    });

    it("should create address with correct data", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/register",
        validVendorData
      );

      await POST(request);

      // Verify address creation
      expect(mockPrisma.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Main Address",
          street1: validVendorData.street1,
          city: validVendorData.city,
          state: validVendorData.state,
          zip: validVendorData.zip,
        }),
      });
    });

    it("should link user to address", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/register",
        validVendorData
      );

      await POST(request);

      // Verify user-address link creation
      expect(mockPrisma.userAddress.create).toHaveBeenCalledWith({
        data: {
          userId: mockProfile.id,
          addressId: mockAddress.id,
          alias: "Main Address",
          isDefault: true,
        },
      });
    });

    it("should handle Prisma unique constraint violation", async () => {
      mockPrisma.profile.create.mockRejectedValue({
        code: "P2002",
        message: "Unique constraint failed",
      });

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        validVendorData
      );

      const response = await POST(request);
      const data = await expectErrorResponse(response, 400);

      expect(data.error).toContain("unique constraint");
    });
  });

  describe("POST /api/register - Email Notification", () => {
    it("should send welcome email to new user with vendor details (REA-104)", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/register",
        validVendorData
      );

      await POST(request);

      // Verify email was sent with vendor details (REA-104 - Vendor Registration Email)
      expect(mockSendEmail).toHaveBeenCalledWith({
        email: validVendorData.email.toLowerCase(),
        name: validVendorData.contact_name,
        userType: "vendor",
        isAdminCreated: false,
        vendorDetails: {
          companyName: validVendorData.company,
          contactName: validVendorData.contact_name,
          phoneNumber: validVendorData.phoneNumber,
          address: {
            street1: validVendorData.street1,
            street2: undefined,
            city: validVendorData.city,
            state: validVendorData.state,
            zip: validVendorData.zip,
          },
          countiesServed: validVendorData.countiesServed,
          timeNeeded: validVendorData.timeNeeded,
          frequency: validVendorData.frequency,
          website: validVendorData.website,
          cateringBrokerage: undefined,
          provisions: undefined,
        },
      });
    });

    it("should still succeed if email sending fails", async () => {
      mockSendEmail.mockResolvedValue(false);

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        validVendorData
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.emailSent).toBe(false);
      expect(data.message).toContain("User created successfully");
    });
  });

  describe("POST /api/register - Error Handling", () => {
    it("should handle malformed JSON body", async () => {
      const request = new NextRequest("http://localhost:3000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{ invalid json",
      });

      const response = await POST(request);
      await expectServerError(response);
    });

    it("should handle unexpected errors gracefully", async () => {
      mockPrisma.profile.create.mockRejectedValue(
        new Error("Unexpected database error")
      );

      const request = createPostRequest(
        "http://localhost:3000/api/register",
        validVendorData
      );

      const response = await POST(request);
      await expectServerError(response);
    });
  });
});
