import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import AuthErrorBoundary from "../AuthErrorBoundary";
import { clearAllHydrationData } from "@/utils/auth/hydration";
import { clearSupabaseCookies } from "@/utils/supabase/client";

jest.mock("@/utils/auth/hydration", () => ({
  clearAllHydrationData: jest.fn(),
}));

jest.mock("@/utils/supabase/client", () => ({
  clearSupabaseCookies: jest.fn(),
}));

const mockClearHydration = clearAllHydrationData as jest.Mock;
const mockClearCookies = clearSupabaseCookies as jest.Mock;

function Boom({ error }: { error: Error }): React.ReactElement {
  throw error;
}

function renderWith(error: Error) {
  return render(
    <AuthErrorBoundary>
      <Boom error={error} />
    </AuthErrorBoundary>,
  );
}

/** A plain render crash whose stack runs through auth-flavoured frames. */
function typeErrorWithAuthStack(): TypeError {
  const error = new TypeError(
    "Cannot read properties of null (reading 'name')",
  );
  error.stack = [
    "TypeError: Cannot read properties of null (reading 'name')",
    "    at DriverSearch (webpack-internal:///./src/components/Driver/DriverSearch.tsx:42:17)",
    "    at AuthProvider (webpack-internal:///./src/contexts/UserContext.tsx:310:5)",
    "    at useAuth (webpack-internal:///./src/hooks/useAuth.ts:12:3)",
    "    at SessionManager.refresh (webpack-internal:///./src/lib/auth/session-manager.ts:88:9)",
    "    at GoTrueClient._useSession (webpack-internal:///./node_modules/@supabase/supabase-js/dist/main.js:1:1)",
  ].join("\n");
  return error;
}

function namedError(name: string, message: string, status?: number): Error {
  const error = new Error(message) as Error & { status?: number };
  error.name = name;
  if (status !== undefined) error.status = status;
  return error;
}

describe("AuthErrorBoundary", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // React logs the caught error; silence it to keep test output readable.
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleError.mockRestore();
  });

  describe("non-auth errors", () => {
    it("does not clear auth state for a TypeError whose stack mentions auth/session/supabase frames", () => {
      renderWith(typeErrorWithAuthStack());

      expect(mockClearHydration).not.toHaveBeenCalled();
      expect(mockClearCookies).not.toHaveBeenCalled();
    });

    it("shows a generic 'Something went wrong' heading, not 'Authentication Error'", () => {
      renderWith(typeErrorWithAuthStack());

      expect(
        screen.getByRole("heading", { name: "Something went wrong" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Authentication Error"),
      ).not.toBeInTheDocument();
    });

    it("does not clear auth state when the user clicks Try Again", () => {
      renderWith(typeErrorWithAuthStack());

      fireEvent.click(screen.getByRole("button", { name: /try again/i }));

      expect(mockClearHydration).not.toHaveBeenCalled();
      expect(mockClearCookies).not.toHaveBeenCalled();
    });

    it.each([
      [
        "a message that merely contains 'token'",
        new Error("Unexpected token < in JSON at position 0"),
      ],
      [
        "a message that merely contains 'session'",
        new Error("sessionStorage is not available"),
      ],
      [
        "a message that merely contains 'auth'",
        new Error("author is undefined"),
      ],
      ["an HTTP 500", namedError("Error", "Internal Server Error", 500)],
    ])("treats %s as non-auth", (_label, error) => {
      renderWith(error);

      expect(mockClearCookies).not.toHaveBeenCalled();
      expect(
        screen.getByRole("heading", { name: "Something went wrong" }),
      ).toBeInTheDocument();
    });
  });

  describe("genuine auth errors", () => {
    it.each([
      [
        "AuthSessionMissingError",
        namedError("AuthSessionMissingError", "Auth session missing!", 400),
      ],
      ["AuthApiError 401", namedError("AuthApiError", "Invalid login", 401)],
      [
        "AuthApiError (refresh token)",
        namedError(
          "AuthApiError",
          "Invalid Refresh Token: Refresh Token Not Found",
          400,
        ),
      ],
      ["app AuthError", namedError("AuthError", "Token refresh failed")],
      [
        "status 401 on a plain error",
        namedError("Error", "Request failed", 401),
      ],
      [
        "status 403 on a plain error",
        namedError("Error", "Request failed", 403),
      ],
      ["'Auth session missing' message", new Error("Auth session missing!")],
      [
        "'Invalid Refresh Token' message",
        new Error("Invalid Refresh Token: Already Used"),
      ],
      ["'JWT expired' message", new Error("JWT expired")],
    ])("treats %s as auth and clears auth state", (_label, error) => {
      renderWith(error);

      expect(mockClearHydration).toHaveBeenCalled();
      expect(mockClearCookies).toHaveBeenCalled();
    });

    it("keeps the 'Authentication Error' heading for auth errors", () => {
      renderWith(
        namedError("AuthSessionMissingError", "Auth session missing!", 400),
      );

      expect(
        screen.getByRole("heading", { name: "Authentication Error" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/problem with your authentication/i),
      ).toBeInTheDocument();
    });
  });
});
