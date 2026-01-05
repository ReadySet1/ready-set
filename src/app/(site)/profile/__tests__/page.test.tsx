import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// System under test
import ProfilePage from "../page";

// Mock Next.js router
const pushMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

// Mock User context to simulate an authenticated client user
jest.mock("@/contexts/UserContext", () => ({
  useUser: () => ({
    session: { access_token: "mock-token" },
    user: { id: "test-user-id", email: "test@example.com" },
    isLoading: false,
  }),
}));

// Mock Supabase client used by the profile page
jest.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: "mock-token" } },
        error: null,
      }),
    },
  }),
}));

// Mock heavy upload hook and component used deeper in the tree
jest.mock("@/hooks/use-upload-file", () => ({
  useUploadFile: () => ({
    progresses: [],
    isUploading: false,
    onUpload: jest.fn(),
  }),
}));

jest.mock("@/components/Uploader/file-uploader", () => ({
  FileUploader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-file-uploader">{children}</div>
  ),
}));

// Mock push notifications hook
jest.mock("@/hooks/usePushNotifications", () => ({
  usePushNotifications: () => ({
    status: "disabled",
    error: null,
    isSupported: true,
    enableOnThisDevice: jest.fn(),
    disableAllDevices: jest.fn(),
  }),
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

// Utility: mock fetch for profile and files requests
const originalFetch = global.fetch;
beforeEach(() => {
  pushMock.mockClear();
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/users/") && !url.endsWith("/files")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "test-user-id",
            email: "test@example.com",
            name: "Test User",
            type: "client",
            status: "active",
            created_at: new Date().toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (url.endsWith("/files")) {
      return Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response("Not Found", { status: 404 }));
  }) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("Profile Page Quick Actions", () => {
  it("navigates to Client Dashboard when clicking 'View Dashboard'", async () => {
    render(<ProfilePage />);

    // Wait for quick actions to render
    const viewDashboardBtn = await screen.findByRole("button", {
      name: /view dashboard/i,
    });

    await userEvent.click(viewDashboardBtn);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/client");
    });
  });

  it("navigates to Client Orders when clicking 'My Orders'", async () => {
    render(<ProfilePage />);

    const myOrdersBtn = await screen.findByRole("button", {
      name: /my orders/i,
    });

    await userEvent.click(myOrdersBtn);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/client/orders");
    });
  });

  it("renders 'Change Password' button", async () => {
    render(<ProfilePage />);

    // Wait for the page to load by checking for Quick Actions section
    await screen.findByText("Quick Actions");

    // Get all buttons with "Change Password" text - the first one is in Quick Actions
    const changePasswordButtons = await screen.findAllByRole("button", {
      name: /change password/i,
    });

    // The Quick Actions button should be found first
    expect(changePasswordButtons.length).toBeGreaterThanOrEqual(1);
    expect(changePasswordButtons[0]).toBeInTheDocument();
  });

  it("opens password change modal when 'Change Password' is clicked", async () => {
    render(<ProfilePage />);

    // Wait for the page to load by checking for Quick Actions section
    await screen.findByText("Quick Actions");

    // Get all buttons with "Change Password" text - the first one is in Quick Actions
    const changePasswordButtons = await screen.findAllByRole("button", {
      name: /change password/i,
    });

    // Click the Quick Actions button (first one)
    await userEvent.click(changePasswordButtons[0]);

    // Modal should open - look for the modal description
    await waitFor(() => {
      expect(
        screen.getByText("Enter your current password and choose a new one")
      ).toBeInTheDocument();
    });
  });
});
