import React from "react";
import { render, waitFor } from "@testing-library/react";
import OnDemandPage from "../page";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
}));

jest.mock("@/components/CateringRequest/OnDemandForm", () => ({
  __esModule: true,
  default: () => <div data-testid="on-demand-form" />,
}));
jest.mock("@/components/Faq", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/Common/SectionTitle", () => ({ __esModule: true, default: () => null }));

const mockGetSession = jest.fn();
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
      },
    }),
  ),
}));

describe("On-demand page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends anonymous visitors to the sign-in page and back to /on-demand afterwards", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    render(<OnDemandPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/sign-in?returnTo=%2Fon-demand");
    });
  });

  it("does not redirect a signed-in user", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });

    const { findByTestId } = render(<OnDemandPage />);

    await findByTestId("on-demand-form");
    expect(mockPush).not.toHaveBeenCalled();
  });
});
