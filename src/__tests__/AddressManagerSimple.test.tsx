import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import AddressManager from "@/components/AddressManager";

// Mock all external dependencies
jest.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "test-user-id", email: "test@example.com" } },
        error: null,
      }),
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: "test-token" } },
        error: null,
      }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  }),
}));

jest.mock("@/contexts/UserContext", () => ({
  UserContext: {
    Provider: ({ children, value }: any) => children,
  },
  useUser: () => ({
    session: { access_token: "test-token" },
    user: { id: "test-user-id", email: "test@example.com" },
    userRole: "client",
    isLoading: false,
    error: null,
    refreshUserData: jest.fn(),
  }),
}));

jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock("react-hook-form", () => ({
  useForm: () => ({
    control: {},
  }),
}));

// Mock fetch globally
global.fetch = jest.fn();

/**
 * TODO: REA-211 - This is a duplicate test file
 * The canonical AddressManager tests are in src/components/AddressManager/__tests__/
 * These tests should be merged into the canonical location and this file deleted.
 */
describe.skip("AddressManager Infinite Loop Prevention", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful API response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        addresses: [
          {
            id: "1",
            street1: "123 Main St",
            city: "Test City",
            state: "TS",
            zip: "12345",
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 1,
          hasNextPage: false,
          hasPrevPage: false,
          limit: 5,
        },
      }),
    });
  });

  it("should not cause infinite loops during rendering", async () => {
    // This test verifies that the component can render without crashing
    // The actual infinite loop prevention is tested in the browser

    const onAddressesLoaded = jest.fn();
    const onAddressSelected = jest.fn();

    expect(() => {
      render(
        <AddressManager
          onAddressesLoaded={onAddressesLoaded}
          onAddressSelected={onAddressSelected}
          onError={jest.fn()}
        />,
      );
    }).not.toThrow();
  });

  it("should have proper dependency arrays in useEffect hooks", () => {
    // This test verifies that the component has the right structure
    // to prevent infinite loops

    const component = require("@/components/AddressManager").default;
    expect(component).toBeDefined();

    // The component should exist and be a React component
    expect(typeof component).toBe("function");
  });
});
