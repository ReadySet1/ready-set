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
  login: jest
    .fn()
    .mockImplementation(async (prevState: any, formData: FormData) => {
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;

      if (!email && !password) {
        return { error: "Email is required" };
      }

      if (!email) {
        return { error: "Email is required" };
      }

      if (!/\S+@\S+\.\S+/.test(email)) {
        return { error: "Please enter a valid email" };
      }

      if (!password) {
        return { error: "Password is required" };
      }

      return { error: "" };
    }),
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
 * These tests should be merged into the canonical file and this file deleted.
 */
describe.skip("SignIn Component", () => {
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
    refreshUserData: jest.fn(),
    isAuthenticating: false,
    authProgress: null,
    clearAuthError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useUser as jest.Mock).mockReturnValue(mockUseUser);
  });

  it("renders the sign-in form correctly", () => {
    render(<Signin />);

    expect(screen.getByText("Sign in with")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows validation error for empty email field", async () => {
    render(<Signin />);

    const submitButton = screen.getByRole("button", { name: "Sign in" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Email is required")).toBeInTheDocument();
    });
  });

  it("shows validation error for empty password field", async () => {
    render(<Signin />);

    const emailInput = screen.getByPlaceholderText("Email");
    const submitButton = screen.getByRole("button", { name: "Sign in" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Password is required")).toBeInTheDocument();
    });
  });

  it("shows validation error for invalid email format", async () => {
    render(<Signin />);

    const emailInput = screen.getByPlaceholderText("Email");
    const submitButton = screen.getByRole("button", { name: "Sign in" });

    fireEvent.change(emailInput, { target: { value: "invalid-email" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Please enter a valid email"),
      ).toBeInTheDocument();
    });
  });

  it("handles successful login without redirect error", async () => {
    const mockLogin = require("@/app/actions/login").login;
    mockLogin.mockResolvedValue({ redirectTo: "/client" });

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

  it("handles redirect errors as successful login", async () => {
    const mockLogin = require("@/app/actions/login").login;
    const redirectError = new Error("NEXT_REDIRECT");
    redirectError.message = "NEXT_REDIRECT";
    mockLogin.mockRejectedValue(redirectError);

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

  it("handles actual login errors correctly", async () => {
    const mockLogin = require("@/app/actions/login").login;
    const actualError = new Error("Invalid credentials");
    actualError.message = "Invalid credentials";
    mockLogin.mockRejectedValue(actualError);

    render(<Signin />);

    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign in" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("An unexpected error occurred. Please try again."),
      ).toBeInTheDocument();
    });
  });

  it("prevents multiple form submissions during loading", async () => {
    const mockLogin = require("@/app/actions/login").login;
    mockLogin.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ redirectTo: "/client" }), 100),
        ),
    );

    render(<Signin />);

    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign in" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    // Click submit multiple times
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Signing in...")).toBeInTheDocument();
    });

    // Verify only one login call was made
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it("shows network error message for network-related errors", async () => {
    const mockLogin = require("@/app/actions/login").login;
    const networkError = new Error("Network error");
    networkError.message = "fetch failed";
    mockLogin.mockRejectedValue(networkError);

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

  it("clears redirect state when user session is detected", async () => {
    const mockLogin = require("@/app/actions/login").login;
    mockLogin.mockResolvedValue({ redirectTo: "/client" });

    const { rerender } = render(<Signin />);

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
    });

    // Simulate user session being detected
    const mockUseUserWithSession = {
      ...mockUseUser,
      session: { user: { id: "123", email: "test@example.com" } },
    };

    (useUser as jest.Mock).mockReturnValue(mockUseUserWithSession);
    rerender(<Signin />);

    await waitFor(() => {
      expect(
        screen.queryByText("Login successful! Redirecting to dashboard..."),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Setting up your dashboard..."),
      ).not.toBeInTheDocument();
    });
  });

  it("switches between password and magic link login methods", () => {
    render(<Signin />);

    // Initially shows password form
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();

    // Click magic link tab
    const magicLinkTab = screen.getByText("Magic Link");
    fireEvent.click(magicLinkTab);

    // Should show magic link form
    expect(
      screen.getByPlaceholderText("Your email address"),
    ).toBeInTheDocument();
    expect(screen.getByText("Send Magic Link")).toBeInTheDocument();

    // Click password tab
    const passwordTab = screen.getByText("Email & Password");
    fireEvent.click(passwordTab);

    // Should show password form again
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
  });

  it("displays search params error message", () => {
    render(<Signin searchParams={{ error: "Session expired" }} />);

    expect(screen.getByText("Session expired")).toBeInTheDocument();
  });

  it("displays search params success message", () => {
    render(
      <Signin searchParams={{ message: "Account created successfully" }} />,
    );

    expect(
      screen.getByText("Account created successfully"),
    ).toBeInTheDocument();
  });
});
