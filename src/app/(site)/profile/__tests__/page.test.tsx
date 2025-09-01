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
});
