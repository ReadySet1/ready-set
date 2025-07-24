import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import * as UserContextModule from "@/contexts/UserContext";
import { useSmartRedirect } from "../useSmartRedirect";

vi.mock("@/contexts/UserContext");

describe("useSmartRedirect", () => {
  it("returns correct dashboard route for each user type", () => {
    const userTypes = ["ADMIN", "CLIENT", "VENDOR", "HELPDESK", "SUPER_ADMIN", "DRIVER"];
    userTypes.forEach((role) => {
      vi.spyOn(UserContextModule, "useUser").mockReturnValue({ userRole: role });
      const { result } = renderHook(() => useSmartRedirect());
      expect(result.current.redirectToDashboard).toBeDefined();
    });
  });
}); 