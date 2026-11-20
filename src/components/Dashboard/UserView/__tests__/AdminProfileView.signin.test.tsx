import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminProfileView from "../AdminProfileView";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Signed-out visitor: auth has finished loading and there is no session.
jest.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ session: null, isLoading: false }),
}));

jest.mock("../hooks/useUserData", () => ({
  useUserData: () => ({
    loading: false,
    isUpdatingStatus: false,
    fetchUser: jest.fn(),
    handleStatusChange: jest.fn(),
    handleRoleChange: jest.fn(),
    handleUploadSuccess: jest.fn(),
    useUploadFileHook: jest.fn(() => ({})),
  }),
}));

jest.mock("../hooks/useUserForm", () => ({
  useUserForm: () => ({
    control: {},
    handleSubmit: jest.fn(),
    watchedValues: {},
    hasUnsavedChanges: false,
    onSubmit: jest.fn(),
    reset: jest.fn(),
    setValue: jest.fn(),
    formState: { isDirty: false },
  }),
}));

describe("AdminProfileView - signed-out state", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.removeItem("admin_mode");
  });

  it("sends the Sign In button to the real sign-in route and returns to this profile", async () => {
    render(<AdminProfileView userId="user 1/abc" />);

    await userEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(
      `/sign-in?returnTo=${encodeURIComponent("/admin/users/user 1/abc")}`,
    );
  });
});
