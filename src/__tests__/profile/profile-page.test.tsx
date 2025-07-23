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

describe("ProfilePage Component", () => {
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

  it("should render loading skeleton when user context is loading", async () => {
    (useUser as any).mockReturnValueOnce({
      ...mockUserContext,
      isLoading: true,
    });

    render(<ProfilePage />);

    // Check for skeleton loading elements
    const skeletonElements = document.querySelectorAll(".animate-pulse");
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it("should redirect to sign-in when no user is authenticated", async () => {
    (useUser as any).mockReturnValueOnce({
      ...mockUserContext,
      user: null,
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/sign-in");
    });
  });

  it("should render profile information when data is loaded", async () => {
    render(<ProfilePage />);

    // Wait for profile to load
    await waitFor(() => {
      // Check for key profile information
      const profileHeader = screen.getByText("My Profile");
      expect(profileHeader).toBeInTheDocument();

      const nameElements = screen.queryAllByText("Test User");
      expect(nameElements.length).toBeGreaterThan(0);

      const emailElement = screen.getByText("test@example.com");
      expect(emailElement).toBeInTheDocument();

      const typeElements = screen.queryAllByText("CLIENT");
      expect(typeElements.length).toBeGreaterThan(0);

      const statusElements = screen.queryAllByText("PENDING");
      expect(statusElements.length).toBeGreaterThan(0);
    });
  });

  it("should handle profile not found scenario", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "User profile not found" }),
    });

    render(<ProfilePage />);

    // Wait for error state
    await waitFor(() => {
      const errorHeader = screen.getByText("Profile Error");
      expect(errorHeader).toBeInTheDocument();

      const goHomeButton = screen.getByText("Go Home");
      expect(goHomeButton).toBeInTheDocument();
    });

    // Click go home button
    const goHomeButton = screen.getByText("Go Home");
    fireEvent.click(goHomeButton);
    expect(mockRouter.push).toHaveBeenCalledWith("/");
  });

  it("should enter edit mode and allow editing profile", async () => {
    render(<ProfilePage />);

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByText("Edit Profile")).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByText("Edit Profile");
    fireEvent.click(editButton);

    // Check if input fields are rendered
    const nameInput = screen.getByPlaceholderText("Enter full name");
    const phoneInput = screen.getByPlaceholderText("Enter phone number");
    const companyInput = screen.getByPlaceholderText("Enter company name");

    // Verify initial values
    expect(nameInput).toHaveValue("Test User");
    expect(phoneInput).toHaveValue("123-456-7890");
    expect(companyInput).toHaveValue("Test Company");

    // Modify inputs
    fireEvent.change(nameInput, { target: { value: "Updated Name" } });
    fireEvent.change(phoneInput, { target: { value: "987-654-3210" } });

    // Mock save API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockProfileData,
        name: "Updated Name",
        contactNumber: "987-654-3210",
      }),
    });

    // Save changes
    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    // Wait for success toast
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Profile updated successfully!",
      );
    });
  });

  it("should handle save errors during profile update", async () => {
    render(<ProfilePage />);

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByText("Edit Profile")).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByText("Edit Profile");
    fireEvent.click(editButton);

    // Mock save API error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Failed to update profile" }),
    });

    // Save changes
    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    // Wait for error message
    await waitFor(() => {
      const errorMessage = screen.getByText(/Error saving profile:/);
      expect(errorMessage).toBeInTheDocument();
    });
  });

  it("should handle quick actions navigation", async () => {
    render(<ProfilePage />);

    // Wait for profile to load
    await waitFor(() => {
      const dashboardButton = screen.getByText("View Dashboard");
      const ordersButton = screen.getByText("My Orders");
      expect(dashboardButton).toBeInTheDocument();
      expect(ordersButton).toBeInTheDocument();
    });

    // Test dashboard navigation
    const dashboardButton = screen.getByText("View Dashboard");
    fireEvent.click(dashboardButton);
    expect(mockRouter.push).toHaveBeenCalledWith("/client");

    // Test orders navigation
    const ordersButton = screen.getByText("My Orders");
    fireEvent.click(ordersButton);
    expect(mockRouter.push).toHaveBeenCalledWith("/order-status");
  });

  it("should handle API errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<ProfilePage />);

    // Wait for error state
    await waitFor(() => {
      const errorHeader = screen.getByText("Profile Error");
      const retryButton = screen.getByText("Retry");
      expect(errorHeader).toBeInTheDocument();
      expect(retryButton).toBeInTheDocument();
    });

    // Test retry button
    const retryButton = screen.getByText("Retry");
    fireEvent.click(retryButton);
    expect(mockUserContext.refreshUserData).toHaveBeenCalled();
  });
});
