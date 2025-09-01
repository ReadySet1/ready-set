import { NextRequest } from "next/server";
import { GET } from "../[order_number]/route";
import { prisma } from "@/utils/prismaDB";
import { createClient } from "@/utils/supabase/server";

// Mocks
jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    cateringRequest: {
      findUnique: jest.fn(),
    },
    onDemand: {
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

type PrismaMock = {
  cateringRequest: { findUnique: jest.Mock };
  onDemand: { findUnique: jest.Mock };
  $disconnect: jest.Mock;
};

const mockPrisma = prisma as unknown as PrismaMock;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe("/api/user-orders/[order_number]", () => {
  const mockUser = { id: "user-1", email: "test@example.com" };

  const baseCatering = {
    id: "cat-1",
    userId: mockUser.id,
    orderNumber: "CAT001",
    status: "ACTIVE",
    pickupDateTime: new Date("2025-01-15T10:00:00Z"),
    arrivalDateTime: new Date("2025-01-15T11:00:00Z"),
    completeDateTime: null,
    orderTotal: 150.0,
    specialNotes: "Leave at reception",
    updatedAt: new Date("2025-01-15T09:10:00Z"),
    pickupAddress: {
      street1: "123 Pickup St",
      city: "San Francisco",
      state: "CA",
      zip: "94103",
    },
    deliveryAddress: {
      street1: "456 Delivery Ave",
      city: "San Francisco",
      state: "CA",
      zip: "94107",
    },
    dispatches: [
      {
        driver: {
          id: "driver-1",
          name: "Danny Driver",
          email: "danny@example.com",
          contactNumber: "555-1234",
        },
      },
    ],
  } as any;

  const baseOnDemand = {
    id: "ond-1",
    userId: mockUser.id,
    orderNumber: "OND001",
    status: "PENDING",
    pickupDateTime: new Date("2025-02-01T10:00:00Z"),
    arrivalDateTime: new Date("2025-02-01T11:00:00Z"),
    completeDateTime: null,
    orderTotal: 75.5,
    specialNotes: null,
    updatedAt: new Date("2025-02-01T09:10:00Z"),
    pickupAddress: {
      street1: "900 Vendor Rd",
      city: "Oakland",
      state: "CA",
      zip: "94612",
    },
    deliveryAddress: {
      street1: "1000 Client St",
      city: "Oakland",
      state: "CA",
      zip: "94607",
    },
    dispatches: [],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    } as any);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as any);

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ order_number: encodeURIComponent("CAT001") }),
    });

    expect(response.status).toBe(401);
  });

  it("normalizes catering order to snake_case fields", async () => {
    mockPrisma.cateringRequest.findUnique.mockResolvedValue(baseCatering);
    mockPrisma.onDemand.findUnique.mockResolvedValue(null);

    const res = await GET({} as NextRequest, {
      params: Promise.resolve({ order_number: encodeURIComponent("CAT001") }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      order_number: "CAT001",
      order_type: "catering",
      status: "active", // lowercased by API
      user_id: mockUser.id,
    });

    // numeric values and nested structures
    expect(typeof data.order_total).toBe("string");
    expect(data.address).toMatchObject({ city: "San Francisco", state: "CA" });
    expect(data.delivery_address).toMatchObject({ city: "San Francisco" });

    // dispatch driver mapping
    expect(Array.isArray(data.dispatch)).toBe(true);
    expect(data.dispatch[0].driver).toMatchObject({
      id: "driver-1",
      name: "Danny Driver",
      contact_number: "555-1234",
    });
  });

  it("falls back to on-demand order and normalizes fields", async () => {
    mockPrisma.cateringRequest.findUnique.mockResolvedValue(null);
    mockPrisma.onDemand.findUnique.mockResolvedValue(baseOnDemand);

    const res = await GET({} as NextRequest, {
      params: Promise.resolve({ order_number: encodeURIComponent("OND001") }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      order_number: "OND001",
      order_type: "on_demand",
      status: "pending",
    });
    expect(data.address.city).toBe("Oakland");
    expect(data.delivery_address.city).toBe("Oakland");
  });

  it("returns 404 when order is not found", async () => {
    mockPrisma.cateringRequest.findUnique.mockResolvedValue(null);
    mockPrisma.onDemand.findUnique.mockResolvedValue(null);

    const res = await GET({} as NextRequest, {
      params: Promise.resolve({ order_number: encodeURIComponent("MISSING") }),
    });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.message).toBe("Order not found");
  });
});


