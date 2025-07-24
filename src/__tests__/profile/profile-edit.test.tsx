import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import ProfilePage from "@/app/(site)/profile/page";
import { toast } from "react-hot-toast";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/contexts/UserContext", () => ({
  useUser: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
  },
  Toaster: vi.fn(() => null),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Profile Edit Functionality", () => {
  const mockRouter = {
    push: vi.fn(),
  };

  const mockUserContext = {
    user: {
      id: "user-123",
      email: "test@example.com",
    },
    isLoading: false,
    error: null,
    refreshUserData: vi.fn(),
    retryAuth: vi.fn(),
    clearError: vi.fn(),
    authState: {
      isInitialized: true,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      retryCount: 0,
      lastAuthCheck: new Date(),
    },
    profileState: {
      data: null,
      isLoading: false,
      error: null,
      lastFetched: null,
      retryCount: 0,
    },
  };

  const mockProfileData = {
    id: "user-123",
    type: "CLIENT",
    email: "test@example.com",
    name: "Test User",
    contactNumber: "123-456-7890",
    companyName: "Test Company",
    status: "pending",
    street1: "123 Test St",
    street2: "",
    city: "Test City",
    state: "TS",
    zip: "12345",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useUser as any).mockReturnValue(mockUserContext);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockProfileData,
    });
  });

  it("should enter edit mode when Edit Profile button is clicked", async () => {
    render(<ProfilePage />);

    // Wait for profile to load
    await waitFor(() => {
      const editButton = screen.getByText("Edit Profile");
      expect(editButton).toBeInTheDocument();
    });

    // Click Edit Profile button
    const editButton = screen.getByText("Edit Profile");
    fireEvent.click(editButton);

    // Check if input fields are rendered
    const nameInput = screen.getByPlaceholderText("Enter full name");
    const phoneInput = screen.getByPlaceholderText("Enter phone number");
    const companyInput = screen.getByPlaceholderText("Enter company name");
    const streetInput = screen.getByPlaceholderText("Enter street address");

    // Verify initial values in edit mode
    expect(nameInput).toHaveValue("Test User");
    expect(phoneInput).toHaveValue("123-456-7890");
    expect(companyInput).toHaveValue("Test Company");
    expect(streetInput).toHaveValue("123 Test St");

    // Verify Save and Cancel buttons are present
    const saveButton = screen.getByText("Save");
    const cancelButton = screen.getByText("Cancel");
    expect(saveButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
  });

  it("should cancel editing and revert changes", async () => {
    render(<ProfilePage />);

    // Wait for profile to load and enter edit mode
    await waitFor(() => {
      const editButton = screen.getByText("Edit Profile");
      fireEvent.click(editButton);
    });

    // Modify input values
    const nameInput = screen.getByPlaceholderText("Enter full name");
    const phoneInput = screen.getByPlaceholderText("Enter phone number");
    fireEvent.change(nameInput, { target: { value: "Updated Name" } });
    fireEvent.change(phoneInput, { target: { value: "987-654-3210" } });

    // Click Cancel button
    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    // Verify values are reverted
    await waitFor(() => {
      const displayedNames = screen.queryAllByText("Test User");
      const displayedPhones = screen.queryAllByText("123-456-7890");
      expect(displayedNames.length).toBeGreaterThan(0);
      expect(displayedPhones.length).toBeGreaterThan(0);
    });
  });

  it("should validate required fields before saving", async () => {
    render(<ProfilePage />);

    // Wait for profile to load and enter edit mode
    await waitFor(() => {
      const editButton = screen.getByText("Edit Profile");
      fireEvent.click(editButton);
    });

    // Clear name input to trigger validation
    const nameInput = screen.getByPlaceholderText("Enter full name");
    fireEvent.change(nameInput, { target: { value: "" } });

    // Click Save button
    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    // Verify error message
    await waitFor(() => {
      const errorMessage = screen.getByText("Full name is required");
      expect(errorMessage).toBeInTheDocument();
    });
  });

  it("should successfully update profile with valid data", async () => {
    render(<ProfilePage />);

    // Wait for profile to load and enter edit mode
    await waitFor(() => {
      const editButton = screen.getByText("Edit Profile");
      fireEvent.click(editButton);
    });

    // Modify input values
    const nameInput = screen.getByPlaceholderText("Enter full name");
    const phoneInput = screen.getByPlaceholderText("Enter phone number");
    const companyInput = screen.getByPlaceholderText("Enter company name");
    fireEvent.change(nameInput, { target: { value: "Updated Name" } });
    fireEvent.change(phoneInput, { target: { value: "987-654-3210" } });
    fireEvent.change(companyInput, { target: { value: "Updated Company" } });

    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockProfileData,
        name: "Updated Name",
        contactNumber: "987-654-3210",
        companyName: "Updated Company",
      }),
    });

    // Click Save button
    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    // Wait for success toast and verify updated values
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Profile updated successfully!",
      );

      // Verify updated values are displayed
      const displayedNames = screen.queryAllByText("Updated Name");
      const displayedPhones = screen.queryAllByText("987-654-3210");
      const displayedCompanies = screen.queryAllByText("Updated Company");
      expect(displayedNames.length).toBeGreaterThan(0);
      expect(displayedPhones.length).toBeGreaterThan(0);
      expect(displayedCompanies.length).toBeGreaterThan(0);
    });
  });

  it("should handle API errors during profile update", async () => {
    render(<ProfilePage />);

    // Wait for profile to load and enter edit mode
    await waitFor(() => {
      const editButton = screen.getByText("Edit Profile");
      fireEvent.click(editButton);
    });

    // Modify input values
    const nameInput = screen.getByPlaceholderText("Enter full name");
    fireEvent.change(nameInput, { target: { value: "Updated Name" } });

    // Mock API error response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Failed to update profile" }),
    });

    // Click Save button
    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    // Wait for error message
    await waitFor(() => {
      const errorMessage = screen.getByText(/Error saving profile:/);
      expect(errorMessage).toBeInTheDocument();
    });
  });

  it("should disable save and cancel buttons during saving", async () => {
    render(<ProfilePage />);

    // Wait for profile to load and enter edit mode
    await waitFor(() => {
      const editButton = screen.getByText("Edit Profile");
      fireEvent.click(editButton);
    });

    // Mock a slow API response
    mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    // Click Save button
    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    // Verify buttons are disabled and saving state is shown
    await waitFor(() => {
      expect(saveButton).toBeDisabled();
      const savingText = screen.getByText("Saving...");
      expect(savingText).toBeInTheDocument();
    });
  });
});
