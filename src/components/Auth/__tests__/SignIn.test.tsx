import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";

// Mock dependencies before importing the component
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

jest.mock("@/contexts/UserContext", () => ({
  useUser: jest.fn(),
}));

// Mock the login action to return validation errors
jest.mock("@/app/actions/login", () => ({
  login: jest
    .fn()
    .mockImplementation(async (prevState: any, formData: FormData) => {
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;

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
  FormState: {} as any,
}));

jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithOtp: jest.fn(),
    },
  })),
}));

jest.mock("@/components/Auth/GoogleAuthButton", () => {
  return function MockGoogleAuthButton() {
    return <button>Sign in with Google</button>;
  };
});

jest.mock("@/components/Common/Loader", () => {
  return function MockLoader() {
    return <div>Loading...</div>;
  };
});

// Import the component after setting up mocks
import SignIn from "../SignIn";

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn(),
};

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

// Default mock user context
const defaultMockUserContext = {
  session: null,
  user: null,
  userRole: null,
  isLoading: false,
  error: null,
  isAuthenticating: false,
  authProgress: { step: "idle" as const, message: "" },
  refreshUserData: jest.fn(),
  clearAuthError: jest.fn(),
  setAuthProgress: jest.fn(),
};

/**
 * TODO: REA-211 - SignIn tests have auth context mocking issues
 */
describe.skip("SignIn Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter);

    // Mock window.location.search for returnTo functionality
    delete (window as any).location;
    window.location = { search: "" } as any;
  });

  describe("rendering", () => {
    it("should render sign-in form with default state", () => {
      mockUseUser.mockReturnValue(defaultMockUserContext);

      render(<SignIn />);

      expect(screen.getByText("Sign in with")).toBeInTheDocument();
      expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^Sign in$/ }),
      ).toBeInTheDocument();
    });

    it("should show loading state when user is loading", () => {
      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        isLoading: true,
      });

      render(<SignIn />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("should return null when user is already signed in", () => {
      const mockUser = { id: "test-user" } as any;
      const mockSession = { user: mockUser } as any;

      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        session: mockSession,
        user: mockUser,
      });

      const { container } = render(<SignIn />);

      expect(container.firstChild).toBeNull();
    });

    it("should display error message from search params", () => {
      mockUseUser.mockReturnValue(defaultMockUserContext);

      const searchParams = { error: "Invalid credentials" };

      render(<SignIn searchParams={searchParams} />);

      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });

    it("should display success message from search params", () => {
      mockUseUser.mockReturnValue(defaultMockUserContext);

      const searchParams = { message: "Please check your email" };

      render(<SignIn searchParams={searchParams} />);

      expect(screen.getByText("Please check your email")).toBeInTheDocument();
    });
  });

  describe("password login interactions", () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue({
        isLoading: false,
        session: null,
        user: null,
        userRole: null,
        error: null,
        isAuthenticating: false,
        authProgress: { step: "idle" as const, message: "" },
        refreshUserData: jest.fn(),
        clearAuthError: jest.fn(),
        setAuthProgress: jest.fn(),
      });
    });

    it("should handle email input changes", async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      const emailInput = screen.getByPlaceholderText("Email");
      await user.type(emailInput, "test@example.com");

      expect(emailInput).toHaveValue("test@example.com");
    });

    it("should handle password input changes", async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      const passwordInput = screen.getByPlaceholderText("Password");
      await user.type(passwordInput, "password123");

      expect(passwordInput).toHaveValue("password123");
    });

    it("should require valid email format", async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      const emailInput = screen.getByPlaceholderText("Email");
      const signInButton = screen.getByRole("button", { name: /sign in$/i });

      // Enter invalid email
      await user.type(emailInput, "invalid-email");

      // Submit the form to trigger validation
      await user.click(signInButton);

      // The component should show validation error
      await waitFor(() => {
        expect(
          screen.getByText("Please enter a valid email"),
        ).toBeInTheDocument();
      });
    });

    it("should require password field", async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      const emailInput = screen.getByPlaceholderText("Email");
      const signInButton = screen.getByRole("button", { name: /sign in$/i });

      // Enter valid email but no password
      await user.type(emailInput, "test@example.com");

      // Submit the form to trigger validation
      await user.click(signInButton);

      // The component should show validation error
      await waitFor(() => {
        expect(screen.getByText("Password is required")).toBeInTheDocument();
      });
    });
  });

  describe("magic link functionality", () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue({
        isLoading: false,
        session: null,
        user: null,
        userRole: null,
        error: null,
        isAuthenticating: false,
        authProgress: { step: "idle" as const, message: "" },
        refreshUserData: jest.fn(),
        clearAuthError: jest.fn(),
        setAuthProgress: jest.fn(),
      });
    });

    it("should switch to magic link mode", async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      const magicLinkButton = screen.getByText("Magic Link");
      await user.click(magicLinkButton);

      expect(screen.getByText("Send Magic Link")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Password")).not.toBeInTheDocument();
    });

    it("should validate email for magic link", async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      // Switch to magic link mode
      const magicLinkButton = screen.getByText("Magic Link");
      await user.click(magicLinkButton);

      const sendButton = screen.getByText("Send Magic Link");
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText("Email is required")).toBeInTheDocument();
      });
    });

    it("should send magic link with valid email", async () => {
      const user = userEvent.setup();
      const mockSupabase = {
        auth: {
          signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
        },
      };

      const { createClient } = await import("@/utils/supabase/client");
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      render(<SignIn />);

      // Switch to magic link mode
      const magicLinkButton = screen.getByText("Magic Link");
      await user.click(magicLinkButton);

      // Enter email and send magic link
      const emailInput = screen.getByPlaceholderText("Your email address");
      await user.type(emailInput, "test@example.com");

      const sendButton = screen.getByText("Send Magic Link");
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
          email: "test@example.com",
          options: {
            shouldCreateUser: false,
            emailRedirectTo: expect.stringContaining("/auth/callback"),
          },
        });
      });

      expect(screen.getByText("Magic link sent!")).toBeInTheDocument();
    });

    it("should handle magic link errors", async () => {
      const user = userEvent.setup();
      const mockSupabase = {
        auth: {
          signInWithOtp: jest.fn().mockResolvedValue({
            error: { message: "User not found" },
          }),
        },
      };

      const { createClient } = await import("@/utils/supabase/client");
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      render(<SignIn />);

      // Switch to magic link mode
      const magicLinkButton = screen.getByText("Magic Link");
      await user.click(magicLinkButton);

      // Enter email and send magic link
      const emailInput = screen.getByPlaceholderText("Your email address");
      await user.type(emailInput, "test@example.com");

      const sendButton = screen.getByText("Send Magic Link");
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/email not found/i)).toBeInTheDocument();
      });
    });
  });

  describe("returnTo URL functionality", () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue({
        isLoading: false,
        session: null,
        user: null,
        userRole: null,
        error: null,
        isAuthenticating: false,
        authProgress: { step: "idle" as const, message: "" },
        refreshUserData: jest.fn(),
        clearAuthError: jest.fn(),
        setAuthProgress: jest.fn(),
      });
    });

    it("should extract returnTo from URL parameters", () => {
      window.location = { search: "?returnTo=/dashboard" } as any;

      render(<SignIn />);

      // The returnTo should be set internally (we can test this through form submission)
      const form = document.querySelector("form");
      expect(form).toBeInTheDocument();
    });

    it("should include returnTo in magic link redirect", async () => {
      const user = userEvent.setup();
      window.location = { search: "?returnTo=/profile" } as any;

      const mockSupabase = {
        auth: {
          signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
        },
      };

      const { createClient } = await import("@/utils/supabase/client");
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      render(<SignIn />);

      // Switch to magic link mode
      const magicLinkButton = screen.getByText("Magic Link");
      await user.click(magicLinkButton);

      // Send magic link
      const emailInput = screen.getByPlaceholderText("Your email address");
      await user.type(emailInput, "test@example.com");

      const sendButton = screen.getByText("Send Magic Link");
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
          email: "test@example.com",
          options: {
            shouldCreateUser: false,
            emailRedirectTo: expect.stringContaining("next=%2Fprofile"),
          },
        });
      });
    });

    it("should use default returnTo when not provided", async () => {
      const user = userEvent.setup();
      window.location = { search: "" } as any;

      const mockSupabase = {
        auth: {
          signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
        },
      };

      const { createClient } = await import("@/utils/supabase/client");
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      render(<SignIn />);

      // Switch to magic link mode
      const magicLinkButton = screen.getByText("Magic Link");
      await user.click(magicLinkButton);

      // Send magic link
      const emailInput = screen.getByPlaceholderText("Your email address");
      await user.type(emailInput, "test@example.com");

      const sendButton = screen.getByText("Send Magic Link");
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
          email: "test@example.com",
          options: {
            shouldCreateUser: false,
            emailRedirectTo: expect.stringContaining("next=%2F"),
          },
        });
      });
    });
  });

  describe("form submission", () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue({
        isLoading: false,
        session: null,
        user: null,
        userRole: null,
        error: null,
        isAuthenticating: false,
        authProgress: { step: "idle" as const, message: "" },
        refreshUserData: jest.fn(),
        clearAuthError: jest.fn(),
        setAuthProgress: jest.fn(),
      });
    });

    it("should submit form with email and password", async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      const emailInput = screen.getByPlaceholderText("Email");
      const passwordInput = screen.getByPlaceholderText("Password");
      const signInButton = screen.getByRole("button", { name: /^Sign in$/ });

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "password123");
      await user.click(signInButton);

      // Verify form was submitted (login action would be called)
      expect(emailInput).toHaveValue("test@example.com");
      expect(passwordInput).toHaveValue("password123");
    });
  });

  describe("accessibility", () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue({
        isLoading: false,
        session: null,
        user: null,
        userRole: null,
        error: null,
        isAuthenticating: false,
        authProgress: { step: "idle" as const, message: "" },
        refreshUserData: jest.fn(),
        clearAuthError: jest.fn(),
        setAuthProgress: jest.fn(),
      });
    });

    it("should have proper form labels and structure", () => {
      render(<SignIn />);

      const emailInput = screen.getByPlaceholderText("Email");
      const passwordInput = screen.getByPlaceholderText("Password");

      expect(emailInput).toHaveAttribute("type", "email");
      expect(passwordInput).toHaveAttribute("type", "password");
      expect(emailInput).toHaveAttribute("required");
      expect(passwordInput).toHaveAttribute("required");
    });

    it("should have proper ARIA attributes for error states", async () => {
      const user = userEvent.setup();
      render(<SignIn />);

      const emailInput = screen.getByPlaceholderText("Email");
      const signInButton = screen.getByRole("button", { name: /sign in$/i });

      // Enter invalid email and submit to trigger validation
      await user.type(emailInput, "invalid-email");
      await user.click(signInButton);

      await waitFor(() => {
        const errorMessage = screen.getByText("Please enter a valid email");
        expect(errorMessage).toBeInTheDocument();
        expect(emailInput).toHaveClass("border-red-500");
      });
    });
  });
});
