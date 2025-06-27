import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import AdminProfileView from "../AdminProfileView";
import { UserFormValues } from "../types";

// Mock the router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue("test-user-id"),
  }),
}));

// Mock the UserContext
vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({
    session: { access_token: "mock-token" },
    user: { id: "current-user-id" },
  }),
}));

// Mock the useUserForm hook
const mockUseUserForm = vi.fn();
vi.mock("../hooks/useUserForm", () => ({
  useUserForm: mockUseUserForm,
}));

// Mock Supabase client
vi.mock("@/utils/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "mock-token" } },
        error: null,
      }),
    },
  })),
}));

describe("AdminProfileView - No Redirect Behavior", () => {
  const mockUserData: UserFormValues = {
    id: "test-user-id",
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
    register: vi.fn(),
    handleSubmit: vi.fn(),
    setValue: vi.fn(),
    watch: vi.fn(),
    watchedValues: mockUserData,
    hasUnsavedChanges: false,
    onSubmit: vi.fn(),
    formState: { errors: {} },
    control: {},
    reset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserForm.mockReturnValue(mockFormMethods);
  });

  it("should call useUserForm without redirect callback", () => {
    render(<AdminProfileView userId="test-user-id" />);

    // Verify that useUserForm was called with only userId and fetchUser
    // No third parameter (onSaveSuccess callback) should be passed
    expect(mockUseUserForm).toHaveBeenCalledWith(
      "test-user-id",
      expect.any(Function),
      // Note: no third parameter means no redirect callback
    );

    // Ensure it was called with exactly 2 arguments (not 3)
    expect(mockUseUserForm).toHaveBeenCalledTimes(1);
    expect(mockUseUserForm.mock.calls[0]).toHaveLength(2);
  });

  it("should stay on form page after save (no redirect)", async () => {
    render(<AdminProfileView userId="test-user-id" />);

    // Simulate successful save by calling the onSubmit function
    await act(async () => {
      mockFormMethods.onSubmit(mockUserData);
    });

    // Verify NO redirect to users list happened
    expect(mockPush).not.toHaveBeenCalled();
  });
});
