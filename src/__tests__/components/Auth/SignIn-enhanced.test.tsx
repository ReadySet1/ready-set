import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import Signin from "@/components/Auth/SignIn";
import { useUser } from "@/contexts/UserContext";

// Mock the dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/contexts/UserContext", () => ({
  useUser: jest.fn(),
}));

jest.mock("@/app/actions/login", () => ({
  login: jest.fn(),
}));

jest.mock("@/components/Auth/GoogleAuthButton", () => {
  return function MockGoogleAuthButton() {
    return <div data-testid="google-auth-button">Google Auth Button</div>;
  };
});

jest.mock("@/components/Common/Loader", () => {
  return function MockLoader() {
    return <div data-testid="loader">Loading...</div>;
  };
});

/**
 * TODO: REA-211 - This is a duplicate test file
 * The canonical SignIn tests are in src/components/Auth/__tests__/SignIn.test.tsx
 * These enhanced tests should be merged into the canonical file and this file deleted.
 */
describe.skip("Enhanced SignIn Component - Phases 3 & 4", () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  };

  const mockUseUser = {
    isLoading: false,
    session: null,
    user: null,
    userRole: null,
    error: null,
    authState: "idle" as const,
    loginProgress: {
      isLoggingIn: false,
      step: "idle" as const,
      message: "",
    },
    refreshUserData: jest.fn(),
    setLoginProgress: jest.fn(),
    clearLoginProgress: jest.fn(),
    handleAuthStateChange: jest.fn(),
    isAuthenticating: false,
    authProgress: null,
    clearAuthError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useUser as jest.Mock).mockReturnValue(mockUseUser);
  });

  describe("Phase 3: Server-Side Optimization Integration", () => {
    it("displays enhanced success message with user type information", async () => {
      const mockLogin = require("@/app/actions/login").login;
      mockLogin.mockResolvedValue({
        success: true,
        message: "Welcome back! Redirecting to your client dashboard...",
        redirectTo: "/client",
        userType: "client",
        userId: "123",
        email: "test@example.com",
      });

      render(<Signin />);

      const emailInput = screen.getByPlaceholderText("Email");
      const passwordInput = screen.getByPlaceholderText("Password");
      const submitButton = screen.getByRole("button", { name: "Sign in" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Login successful! Redirecting to dashboard..."),
        ).toBeInTheDocument();
        expect(
          screen.getByText("Setting up your dashboard..."),
        ).toBeInTheDocument();
      });
    });

    it("handles enhanced error messages from server", async () => {
      const mockLogin = require("@/app/actions/login").login;
      mockLogin.mockResolvedValue({
        error: "Database connection failed. Please try again in a moment.",
        success: false,
      });

      render(<Signin />);

      const emailInput = screen.getByPlaceholderText("Email");
      const passwordInput = screen.getByPlaceholderText("Password");
      const submitButton = screen.getByRole("button", { name: "Sign in" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Database connection failed. Please try again in a moment.",
          ),
        ).toBeInTheDocument();
      });
    });

    it("shows enhanced validation error for missing fields", async () => {
      const mockLogin = require("@/app/actions/login").login;
      mockLogin.mockResolvedValue({
        error: "Missing required fields: email, password",
        success: false,
      });

      render(<Signin />);

      const submitButton = screen.getByRole("button", { name: "Sign in" });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Email is required")).toBeInTheDocument();
        expect(screen.getByText("Password is required")).toBeInTheDocument();
      });
    });
  });

  describe("Phase 4: Context Integration", () => {
    it("updates login progress in context during authentication", async () => {
      const mockLogin = require("@/app/actions/login").login;
      mockLogin.mockResolvedValue({
        success: true,
        redirectTo: "/client",
        userType: "client",
      });

      const mockSetLoginProgress = jest.fn();
      const mockClearLoginProgress = jest.fn();

      (useUser as jest.Mock).mockReturnValue({
        ...mockUseUser,
        setLoginProgress: mockSetLoginProgress,
        clearLoginProgress: mockClearLoginProgress,
      });

      render(<Signin />);

      const emailInput = screen.getByPlaceholderText("Email");
      const passwordInput = screen.getByPlaceholderText("Password");
      const submitButton = screen.getByRole("button", { name: "Sign in" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSetLoginProgress).toHaveBeenCalledWith({
          isLoggingIn: true,
          step: "validating",
          message: "Validating credentials...",
        });
      });

      await waitFor(() => {
        expect(mockSetLoginProgress).toHaveBeenCalledWith({
          step: "authenticating",
          message: "Authenticating with server...",
        });
      });
    });

    it("displays context-based login progress messages", async () => {
      const mockLogin = require("@/app/actions/login").login;
      mockLogin.mockResolvedValue({
        success: true,
        redirectTo: "/client",
      });

      (useUser as jest.Mock).mockReturnValue({
        ...mockUseUser,
        loginProgress: {
          isLoggingIn: true,
          step: "setting_session",
          message: "Setting up your session...",
        },
      });

      render(<Signin />);

      await waitFor(() => {
        expect(
          screen.getByText("Setting up your session..."),
        ).toBeInTheDocument();
        expect(
          screen.getByText("Please wait while we complete your login..."),
        ).toBeInTheDocument();
      });
    });

    it("clears login progress when authentication completes", async () => {
      const mockLogin = require("@/app/actions/login").login;
      mockLogin.mockResolvedValue({
        success: true,
        redirectTo: "/client",
      });

      const mockClearLoginProgress = jest.fn();

      (useUser as jest.Mock).mockReturnValue({
        ...mockUseUser,
        clearLoginProgress: mockClearLoginProgress,
      });

      render(<Signin />);

      const emailInput = screen.getByPlaceholderText("Email");
      const passwordInput = screen.getByPlaceholderText("Password");
      const submitButton = screen.getByRole("button", { name: "Sign in" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockClearLoginProgress).toHaveBeenCalled();
      });
    });

    it("responds to auth state changes from context", async () => {
      const mockLogin = require("@/app/actions/login").login;
      mockLogin.mockResolvedValue({
        success: true,
        redirectTo: "/client",
      });

      const { rerender } = render(<Signin />);

      // Simulate auth state change to 'authenticating'
      (useUser as jest.Mock).mockReturnValue({
        ...mockUseUser,
        authState: "authenticating",
        loginProgress: {
          isLoggingIn: true,
          step: "authenticating",
          message: "Authentication successful, setting up your session...",
        },
      });

      rerender(<Signin />);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Authentication successful, setting up your session...",
          ),
        ).toBeInTheDocument();
      });
    });

    it("disables submit button during context-based loading states", async () => {
      (useUser as jest.Mock).mockReturnValue({
        ...mockUseUser,
        loginProgress: {
          isLoggingIn: true,
          step: "authenticating",
          message: "Processing...",
        },
      });

      render(<Signin />);

      const submitButton = screen.getByRole("button", { name: "Sign in" });
      expect(submitButton).toBeDisabled();
    });
  });

  describe("Enhanced Error Handling", () => {
    it("provides specific error messages for different error types", async () => {
      const mockLogin = require("@/app/actions/login").login;

      // Test network error
      mockLogin.mockRejectedValue(new Error("fetch failed"));

      render(<Signin />);

      const emailInput = screen.getByPlaceholderText("Email");
      const passwordInput = screen.getByPlaceholderText("Password");
      const submitButton = screen.getByRole("button", { name: "Sign in" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Network error. Please check your connection and try again.",
          ),
        ).toBeInTheDocument();
      });
    });

    it("handles timeout errors gracefully", async () => {
      const mockLogin = require("@/app/actions/login").login;
      mockLogin.mockRejectedValue(new Error("timeout"));

      render(<Signin />);

      const emailInput = screen.getByPlaceholderText("Email");
      const passwordInput = screen.getByPlaceholderText("Password");
      const submitButton = screen.getByRole("button", { name: "Sign in" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Request timed out. Please try again."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Integration Features", () => {
    it("maintains backward compatibility with existing functionality", async () => {
      render(<Signin />);

      expect(screen.getByText("Sign in with")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Sign in" }),
      ).toBeInTheDocument();
    });

    it("handles magic link functionality correctly", async () => {
      render(<Signin />);

      // Click magic link tab
      const magicLinkTab = screen.getByText("Magic Link");
      fireEvent.click(magicLinkTab);

      expect(
        screen.getByPlaceholderText("Your email address"),
      ).toBeInTheDocument();
      expect(screen.getByText("Send Magic Link")).toBeInTheDocument();
    });

    it("displays search params messages correctly", async () => {
      render(
        <Signin
          searchParams={{
            error: "Session expired",
            message: "Account created successfully",
          }}
        />,
      );

      expect(screen.getByText("Session expired")).toBeInTheDocument();
      expect(
        screen.getByText("Account created successfully"),
      ).toBeInTheDocument();
    });
  });
});
