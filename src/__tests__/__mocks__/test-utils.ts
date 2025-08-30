import { Session, User } from "@supabase/supabase-js";
import { UserType } from "@/types/user";

// Mock Supabase Session type for testing
export const createMockSession = (overrides: Partial<Session> = {}): Session => ({
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: createMockUser(),
  ...overrides,
});

// Mock Supabase User type for testing
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: "test-user-id",
  email: "test@example.com",
  user_metadata: { name: "Test User" },
  app_metadata: {},
  aud: "authenticated",
  created_at: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

// Mock UserType for testing
export const createMockUserContext = (overrides: Partial<{
  session: Session | null;
  user: User | null;
  userRole: UserType | null;
  isLoading: boolean;
  error: string | null;
  refreshUserData: () => Promise<void>;
}> = {}) => ({
  session: createMockSession(),
  user: createMockUser(),
  userRole: UserType.CLIENT,
  isLoading: false,
  error: null,
  refreshUserData: jest.fn(),
  ...overrides,
});

// Mock addresses for testing
export const mockAddresses = [
  {
    id: "1",
    street1: "123 Main St",
    street2: null,
    city: "Test City",
    state: "TS",
    zip: "12345",
    county: "Test County",
    isRestaurant: false,
    isShared: false,
    locationNumber: null,
    parkingLoading: null,
    createdAt: new Date(),
    createdBy: "test-user-id",
    updatedAt: new Date(),
  },
  {
    id: "2",
    street1: "456 Oak Ave",
    street2: "Suite 100",
    city: "Test City",
    state: "TS",
    zip: "12345",
    county: "Test County",
    isRestaurant: true,
    isShared: true,
    locationNumber: "A1",
    parkingLoading: "Front door",
    createdAt: new Date(),
    createdBy: "test-user-id",
    updatedAt: new Date(),
  },
];
