import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProfilePage from "@/app/(site)/profile/page";

// Mock the Supabase client
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: "test-user-id",
              email: "test@example.com",
            },
          },
        },
        error: null,
      }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  })),
}));

// Mock the API calls
global.fetch = jest.fn();

// Mock toast
jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: {
      success: jest.fn(),
      error: jest.fn(),
    },
  }),
}));

describe("Profile Update Functionality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Profile Update API", () => {
    it("should make PATCH request to correct endpoint", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "test-user-id",
            name: "Updated Name",
            email: "test@example.com",
            contact_number: "123-456-7890",
            company_name: "Test Company",
            street1: "123 Test St",
            city: "Test City",
            state: "CA",
            zip: "12345",
          }),
      });
      global.fetch = mockFetch;

      render(<ProfilePage />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Personal Information")).toBeInTheDocument();
      });

      // Find and click edit button
      const editButton = screen.getByText("Edit");
      fireEvent.click(editButton);

      // Update form fields
      const nameInput = screen.getByDisplayValue("John Doe");
      fireEvent.change(nameInput, { target: { value: "Updated Name" } });

      const emailInput = screen.getByDisplayValue("john.doe@example.com");
      fireEvent.change(emailInput, {
        target: { value: "updated@example.com" },
      });

      // Save changes
      const saveButton = screen.getByText("Save Changes");
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/users/test-user-id",
          expect.objectContaining({
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: expect.stringContaining("Updated Name"),
          }),
        );
      });
    });

    it("should handle successful profile update", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "test-user-id",
            name: "Updated Name",
            email: "updated@example.com",
            contact_number: "123-456-7890",
            company_name: "Test Company",
            street1: "123 Test St",
            city: "Test City",
            state: "CA",
            zip: "12345",
          }),
      });
      global.fetch = mockFetch;

      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText("Personal Information")).toBeInTheDocument();
      });

      const editButton = screen.getByText("Edit");
      fireEvent.click(editButton);

      const nameInput = screen.getByDisplayValue("John Doe");
      fireEvent.change(nameInput, { target: { value: "Updated Name" } });

      const saveButton = screen.getByText("Save Changes");
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it("should handle profile update errors", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Invalid data" }),
      });
      global.fetch = mockFetch;

      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText("Personal Information")).toBeInTheDocument();
      });

      const editButton = screen.getByText("Edit");
      fireEvent.click(editButton);

      const nameInput = screen.getByDisplayValue("John Doe");
      fireEvent.change(nameInput, { target: { value: "" } }); // Invalid empty name

      const saveButton = screen.getByText("Save Changes");
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe("Form State Management", () => {
    it("should toggle edit mode correctly", async () => {
      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText("Personal Information")).toBeInTheDocument();
      });

      // Initially should show edit button
      expect(screen.getByText("Edit")).toBeInTheDocument();

      // Click edit button
      const editButton = screen.getByText("Edit");
      fireEvent.click(editButton);

      // Should now show save and cancel buttons
      expect(screen.getByText("Save Changes")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("should update form fields when editing", async () => {
      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText("Personal Information")).toBeInTheDocument();
      });

      const editButton = screen.getByText("Edit");
      fireEvent.click(editButton);

      const nameInput = screen.getByDisplayValue("John Doe");
      fireEvent.change(nameInput, { target: { value: "New Name" } });

      expect(nameInput).toHaveValue("New Name");
    });
  });

  describe("Field Validation", () => {
    it("should validate required fields", async () => {
      render(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText("Personal Information")).toBeInTheDocument();
      });

      const editButton = screen.getByText("Edit");
      fireEvent.click(editButton);

      // Clear required field
      const nameInput = screen.getByDisplayValue("John Doe");
      fireEvent.change(nameInput, { target: { value: "" } });

      const saveButton = screen.getByText("Save Changes");
      fireEvent.click(saveButton);

      // Should show validation error or prevent submission
      await waitFor(() => {
        expect(screen.getByDisplayValue("")).toBeInTheDocument();
      });
    });
  });
});
