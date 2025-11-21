import { OrderStatus, OrderType } from "@/types/order";

// Mock Next.js navigation
export const mockPush = jest.fn();
export const mockPathname = jest.fn();
export const mockParams = jest.fn();
export const mockRouter = { push: mockPush };

export const setupNavigationMocks = () => {
  mockPush.mockClear();
  mockPathname.mockClear();
  mockParams.mockClear();
};

// Mock Supabase
export const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({
      data: { session: { access_token: "mock-token" } },
      error: null,
    }),
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    }),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: { type: "ADMIN" },
          error: null,
        }),
      })),
    })),
  })),
  storage: {
    listBuckets: jest.fn().mockResolvedValue({
      data: [{ name: "user-assets" }],
      error: null,
    }),
  },
};

// Common Test Data
export const mockOrder = {
  id: "6b5c977d-ee51-411a-a695-8c95d88735df",
  orderNumber: "SF-56780",
  status: OrderStatus.ACTIVE,
  order_type: "catering" as OrderType,
  orderTotal: 250.0,
  pickupDateTime: "2025-09-25T12:00:00Z",
  arrivalDateTime: null,
  completeDateTime: null,
  createdAt: "2025-09-23T10:00:00Z",
  updatedAt: "2025-09-23T10:00:00Z",
  userId: "9e5b3515-4e8b-4c6b-a9fc-f9388548a7dd",
  dispatches: [],
};

export const mockDrivers = [
  {
    id: "d2e6f3ef-d801-4dd0-b840-c8de7754a6bd",
    name: "David Sanchez",
    email: "davids2002@gmail.com",
    contactNumber: "4792608514",
  },
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "John Doe",
    email: "john.doe@example.com",
    contactNumber: "5551234567",
  },
];

