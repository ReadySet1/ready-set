process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "dummy-key";

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Supabase client to prevent env var errors
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: { user: { id: "test", email: "test@example.com" } },
        },
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  }),
}));

import CateringPage from "./page";

// Mock subcomponents to focus on layout
vi.mock("@/components/CateringRequest/CateringRequestForm", () => ({
  default: () => (
    <div data-testid="catering-request-form">CateringRequestForm</div>
  ),
}));
vi.mock("@/components/ErrorBoundary/CateringFormErrorBoundary", () => ({
  CateringFormErrorBoundary: ({ children }: any) => <>{children}</>,
}));

// DeliveryChecklist is defined in the same file, so we can't mock it easily. We'll check for its text.
describe("Catering Request Page Layout", () => {
  it("renders header, checklist, and form in correct order with correct spacing", async () => {
    render(<CateringPage />);

    // Wait for header to appear after loading
    const header = await screen.findByRole("heading", {
      name: /Catering Request/i,
    });
    expect(header).toBeInTheDocument();
    // Check header margin class (mt-20)
    expect(header.parentElement).toHaveClass("mt-20");

    // Checklist
    expect(screen.getByText(/8-Point Delivery Checklist/i)).toBeInTheDocument();

    // Form
    const form = screen.getByTestId("catering-request-form");
    expect(form).toBeInTheDocument();
    // Check form margin class (mt-20)
    expect(form.parentElement).toHaveClass("mt-20");

    // Order: checklist appears before form
    const checklist = screen.getByText(/8-Point Delivery Checklist/i);
    expect(checklist.compareDocumentPosition(form)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
