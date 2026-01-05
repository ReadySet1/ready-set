import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PasswordChangeModal from "../PasswordChangeModal";

// Mock Supabase client
const mockSignInWithPassword = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      updateUser: mockUpdateUser,
    },
  }),
}));

// Mock react-hot-toast
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

// Mock pointer capture methods for Radix Dialog compatibility
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  value: jest.fn(),
  writable: true,
});

Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
  value: jest.fn(),
  writable: true,
});

Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
  value: jest.fn(),
  writable: true,
});

describe("PasswordChangeModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    userEmail: "test@example.com",
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default successful mocks
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  describe("Rendering", () => {
    it("renders modal title", () => {
      render(<PasswordChangeModal {...defaultProps} />);

      // Title is in the dialog title element
      expect(screen.getByTestId("dialog-title")).toHaveTextContent("Change Password");
    });

    it("renders modal description", () => {
      render(<PasswordChangeModal {...defaultProps} />);

      expect(
        screen.getByText("Enter your current password and choose a new one")
      ).toBeInTheDocument();
    });

    it("renders all three password fields", () => {
      render(<PasswordChangeModal {...defaultProps} />);

      expect(screen.getByLabelText(/^current password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^confirm new password$/i)).toBeInTheDocument();
    });

    it("renders Cancel and Change Password buttons", () => {
      render(<PasswordChangeModal {...defaultProps} />);

      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^change password$/i })
      ).toBeInTheDocument();
    });
  });

  describe("Form Validation", () => {
    it("shows error when current password is empty", async () => {
      render(<PasswordChangeModal {...defaultProps} />);

      await userEvent.type(screen.getByLabelText(/^new password$/i), "newpass123");
      await userEvent.type(
        screen.getByLabelText(/^confirm new password$/i),
        "newpass123"
      );

      await userEvent.click(
        screen.getByRole("button", { name: /^change password$/i })
      );

      expect(
        screen.getByText("Current password is required")
      ).toBeInTheDocument();
    });

    it("shows error when new password is too short", async () => {
      render(<PasswordChangeModal {...defaultProps} />);

      await userEvent.type(
        screen.getByLabelText(/^current password$/i),
        "oldpass123"
      );
      await userEvent.type(screen.getByLabelText(/^new password$/i), "short");
      await userEvent.type(screen.getByLabelText(/^confirm new password$/i), "short");

      await userEvent.click(
        screen.getByRole("button", { name: /^change password$/i })
      );

      expect(
        screen.getByText("Password must be at least 8 characters")
      ).toBeInTheDocument();
    });

    it("shows error when passwords do not match", async () => {
      render(<PasswordChangeModal {...defaultProps} />);

      await userEvent.type(
        screen.getByLabelText(/^current password$/i),
        "oldpass123"
      );
      await userEvent.type(screen.getByLabelText(/^new password$/i), "newpass123");
      await userEvent.type(
        screen.getByLabelText(/^confirm new password$/i),
        "different123"
      );

      await userEvent.click(
        screen.getByRole("button", { name: /^change password$/i })
      );

      expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    });

    it("shows error when new password is same as current", async () => {
      render(<PasswordChangeModal {...defaultProps} />);

      await userEvent.type(
        screen.getByLabelText(/^current password$/i),
        "samepass123"
      );
      await userEvent.type(screen.getByLabelText(/^new password$/i), "samepass123");
      await userEvent.type(
        screen.getByLabelText(/^confirm new password$/i),
        "samepass123"
      );

      await userEvent.click(
        screen.getByRole("button", { name: /^change password$/i })
      );

      expect(
        screen.getByText("New password must be different from current password")
      ).toBeInTheDocument();
    });

    it("clears error when user starts typing in field", async () => {
      render(<PasswordChangeModal {...defaultProps} />);

      // Submit to trigger validation error
      await userEvent.click(
        screen.getByRole("button", { name: /^change password$/i })
      );

      expect(
        screen.getByText("Current password is required")
      ).toBeInTheDocument();

      // Start typing - error should clear
      await userEvent.type(
        screen.getByLabelText(/^current password$/i),
        "a"
      );

      expect(
        screen.queryByText("Current password is required")
      ).not.toBeInTheDocument();
    });
  });

  describe("Password Visibility Toggle", () => {
    it("toggles current password visibility", async () => {
      render(<PasswordChangeModal {...defaultProps} />);

      const currentPasswordInput = screen.getByLabelText(/^current password$/i);
      expect(currentPasswordInput).toHaveAttribute("type", "password");

      // Find the toggle button (first eye button) - buttons with tabIndex -1 are toggle buttons
      const toggleButtons = screen.getAllByRole("button").filter(
        (btn) => btn.getAttribute("tabindex") === "-1"
      );
      await userEvent.click(toggleButtons[0]);

      expect(currentPasswordInput).toHaveAttribute("type", "text");
    });

    it("toggles new password visibility", async () => {
      render(<PasswordChangeModal {...defaultProps} />);

      const newPasswordInput = screen.getByLabelText(/^new password$/i);
      expect(newPasswordInput).toHaveAttribute("type", "password");

      // Toggle buttons have tabIndex -1
      const toggleButtons = screen.getAllByRole("button").filter(
        (btn) => btn.getAttribute("tabindex") === "-1"
      );

      await userEvent.click(toggleButtons[1]);

      expect(newPasswordInput).toHaveAttribute("type", "text");
    });
  });

  describe("Supabase Integration", () => {
    it("verifies current password before updating", async () => {
      render(<PasswordChangeModal {...defaultProps} />);

      await userEvent.type(
        screen.getByLabelText(/^current password$/i),
        "currentpass123"
      );
      await userEvent.type(
        screen.getByLabelText(/^new password$/i),
        "newpass123"
      );
      await userEvent.type(
        screen.getByLabelText(/^confirm new password$/i),
        "newpass123"
      );

      await userEvent.click(
        screen.getByRole("button", { name: /^change password$/i })
      );

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "currentpass123",
        });
      });
    });

    it("calls updateUser after successful verification", async () => {
      render(<PasswordChangeModal {...defaultProps} />);

      await userEvent.type(
        screen.getByLabelText(/^current password$/i),
        "currentpass123"
      );
      await userEvent.type(
        screen.getByLabelText(/^new password$/i),
        "newpass123"
      );
      await userEvent.type(
        screen.getByLabelText(/^confirm new password$/i),
        "newpass123"
      );

      await userEvent.click(
        screen.getByRole("button", { name: /^change password$/i })
      );

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith({
          password: "newpass123",
        });
      });
    });

    it("calls onSuccess after successful password change", async () => {
      const onSuccess = jest.fn();
      render(<PasswordChangeModal {...defaultProps} onSuccess={onSuccess} />);

      await userEvent.type(
        screen.getByLabelText(/^current password$/i),
        "currentpass123"
      );
      await userEvent.type(
        screen.getByLabelText(/^new password$/i),
        "newpass123"
      );
      await userEvent.type(
        screen.getByLabelText(/^confirm new password$/i),
        "newpass123"
      );

      await userEvent.click(
        screen.getByRole("button", { name: /^change password$/i })
      );

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it("shows error when current password is incorrect", async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: "Invalid credentials" },
      });

      render(<PasswordChangeModal {...defaultProps} />);

      await userEvent.type(
        screen.getByLabelText(/^current password$/i),
        "wrongpassword"
      );
      await userEvent.type(
        screen.getByLabelText(/^new password$/i),
        "newpass123"
      );
      await userEvent.type(
        screen.getByLabelText(/^confirm new password$/i),
        "newpass123"
      );

      await userEvent.click(
        screen.getByRole("button", { name: /^change password$/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText("Current password is incorrect")
        ).toBeInTheDocument();
      });

      // updateUser should not be called
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("does not call updateUser when verification fails", async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: "Invalid credentials" },
      });

      render(<PasswordChangeModal {...defaultProps} />);

      await userEvent.type(
        screen.getByLabelText(/^current password$/i),
        "wrongpassword"
      );
      await userEvent.type(
        screen.getByLabelText(/^new password$/i),
        "newpass123"
      );
      await userEvent.type(
        screen.getByLabelText(/^confirm new password$/i),
        "newpass123"
      );

      await userEvent.click(
        screen.getByRole("button", { name: /^change password$/i })
      );

      await waitFor(() => {
        expect(mockUpdateUser).not.toHaveBeenCalled();
      });
    });
  });

  describe("Loading State", () => {
    it("shows loading text during submission", async () => {
      // Make the request hang
      mockSignInWithPassword.mockImplementation(
        () => new Promise(() => {})
      );

      render(<PasswordChangeModal {...defaultProps} />);

      await userEvent.type(
        screen.getByLabelText(/^current password$/i),
        "currentpass123"
      );
      await userEvent.type(
        screen.getByLabelText(/^new password$/i),
        "newpass123"
      );
      await userEvent.type(
        screen.getByLabelText(/^confirm new password$/i),
        "newpass123"
      );

      await userEvent.click(
        screen.getByRole("button", { name: /^change password$/i })
      );

      expect(
        screen.getByRole("button", { name: /updating/i })
      ).toBeInTheDocument();
    });

    it("disables inputs during submission", async () => {
      mockSignInWithPassword.mockImplementation(
        () => new Promise(() => {})
      );

      render(<PasswordChangeModal {...defaultProps} />);

      await userEvent.type(
        screen.getByLabelText(/^current password$/i),
        "currentpass123"
      );
      await userEvent.type(
        screen.getByLabelText(/^new password$/i),
        "newpass123"
      );
      await userEvent.type(
        screen.getByLabelText(/^confirm new password$/i),
        "newpass123"
      );

      await userEvent.click(
        screen.getByRole("button", { name: /^change password$/i })
      );

      expect(screen.getByLabelText(/^current password$/i)).toBeDisabled();
      expect(screen.getByLabelText(/^new password$/i)).toBeDisabled();
      expect(screen.getByLabelText(/^confirm new password$/i)).toBeDisabled();
    });
  });

  describe("Modal Behavior", () => {
    it("calls onClose when Cancel button is clicked", async () => {
      const onClose = jest.fn();
      render(<PasswordChangeModal {...defaultProps} onClose={onClose} />);

      await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("resets form when modal closes and reopens", () => {
      const { rerender } = render(
        <PasswordChangeModal {...defaultProps} isOpen={true} />
      );

      // Type in the form
      const currentPasswordInput = screen.getByLabelText(/^current password$/i);
      userEvent.type(currentPasswordInput, "somepassword");

      // Close the modal
      rerender(<PasswordChangeModal {...defaultProps} isOpen={false} />);

      // Reopen the modal
      rerender(<PasswordChangeModal {...defaultProps} isOpen={true} />);

      // Form should be reset
      expect(screen.getByLabelText(/^current password$/i)).toHaveValue("");
    });
  });
});
