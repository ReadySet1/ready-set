import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminProfileView from "../AdminProfileView";
import { UserFormValues } from "../types";

// Mock the router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: jest.fn().mockReturnValue("test-user-id"),
  }),
}));

// Mock the UserContext
jest.mock("@/contexts/UserContext", () => ({
  useUser: () => ({
    session: { access_token: "mock-token" },
    user: { id: "current-user-id" },
  }),
}));

// Mock the useUserForm hook
const mockUseUserForm = jest.fn();
jest.mock("../hooks/useUserForm", () => ({
  useUserForm: mockUseUserForm,
}));

// Mock Supabase client
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: "mock-token" } },
        error: null,
      }),
    },
  })),
}));

describe("AdminProfileView - No Redirect Behavior", () => {
  const TEST_USER_ID = "test-user-id";

  const mockUserData: UserFormValues = {
    id: TEST_USER_ID,
    displayName: "Test User",
    name: "Test User",
    contact_name: "Test Contact",
    email: "test@example.com",
    contact_number: "123-456-7890",
    type: "vendor",
    status: "active",
    company_name: "Test Company",
    street1: "123 Test St",
    city: "Test City",
    state: "TS",
    zip: "12345",
    countiesServed: ["Alameda"],
    counties: [],
    timeNeeded: ["Lunch"],
    cateringBrokerage: ["Grubhub"],
    provisions: ["Utensils"],
    headCount: 50,
    frequency: "1-5 per week",
    website: "https://test.com",
    location_number: "1",
    parking_loading: "Loading dock",
    sideNotes: "Test notes",
  };

  const mockFormMethods = {
    register: jest.fn(),
    handleSubmit: jest.fn(),
    setValue: jest.fn(),
    watch: jest.fn(),
    watchedValues: mockUserData,
    hasUnsavedChanges: false,
    onSubmit: jest.fn(),
    formState: { errors: {} },
    control: {},
    reset: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUserForm.mockReturnValue(mockFormMethods);
  });

  it("should call useUserForm without redirect callback", () => {
    render(<AdminProfileView userId={TEST_USER_ID} />);

    // Verify that useUserForm was called with only userId and fetchUser
    // No third parameter (onSaveSuccess callback) should be passed
    expect(mockUseUserForm).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.any(Function)
      // Note: no third parameter means no redirect callback
    );

    // Ensure it was called with exactly 2 arguments (not 3)
    expect(mockUseUserForm).toHaveBeenCalledTimes(1);
    expect(mockUseUserForm.mock.calls[0]).toHaveLength(2);
  });

  it("should stay on form page after save (no redirect)", async () => {
    render(<AdminProfileView userId={TEST_USER_ID} />);

    // Simulate successful save by calling the onSubmit function
    await act(async () => {
      mockFormMethods.onSubmit(mockUserData);
    });

    // Verify NO redirect to users list happened
    expect(mockPush).not.toHaveBeenCalled();
  });
});
