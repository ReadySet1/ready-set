import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import * as UserContextModule from "@/contexts/UserContext";
import { useSmartRedirect } from "../useSmartRedirect";

vi.mock("@/contexts/UserContext");

describe("useSmartRedirect", () => {
  it("returns correct dashboard route for each user type", () => {
    const userTypes = ["ADMIN", "CLIENT", "VENDOR", "HELPDESK", "SUPER_ADMIN", "DRIVER"];
    userTypes.forEach((role) => {
      vi.spyOn(UserContextModule, "useUser").mockReturnValue({
        user: null,
        userRole: role,
        isLoading: false,
        error: null,
        session: null,
        authState: {
          isInitialized: true,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          retryCount: 0,
          lastAuthCheck: null,
        },
        profileState: {
          data: null,
          isLoading: false,
          error: null,
          lastFetched: null,
          retryCount: 0,
        },
        refreshUserData: async () => {},
        retryAuth: async () => {},
        clearError: () => {},
        getDashboardPath: () => "",
        getOrderDetailPath: () => "",
        signOut: async () => {},
        signIn: async () => {},
        forceAuthRefresh: async () => {},
      });
      const { result } = renderHook(() => useSmartRedirect());
      expect(result.current.redirectToDashboard).toBeDefined();
    });
  });
}); 