import { NextRequest } from "next/server";
import { GET } from "../route";

// Mock dependencies
jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    cateringRequest: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    onDemand: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $disconnect: jest.fn(),
  },
}));

jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "test-user", email: "test@example.com" } },
        error: null,
      }),
    },
  }),
}));

describe("Simple API Test", () => {
  it("should handle basic request", async () => {
    // Create a proper NextRequest with URL
    const request = new NextRequest("http://localhost:3000/api/user-orders");
    
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.orders).toBeDefined();
    expect(data.pagination).toBeDefined();
  });

  it("should handle unauthenticated user", async () => {
    const { createClient } = require("@/utils/supabase/server");
    createClient.mockResolvedValueOnce({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    const request = new NextRequest("http://localhost:3000/api/user-orders");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe("Unauthorized");
  });

  it("should handle pagination parameters", async () => {
    // Create a mock NextRequest with URL property
    const mockRequest = {
      url: "http://localhost:3000/api/user-orders?page=2&limit=3"
    } as NextRequest;
    
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination.currentPage).toBe(2);
    expect(data.pagination.ordersPerPage).toBe(3);
  });
}); 