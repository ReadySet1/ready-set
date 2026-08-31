import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DriverReturnSheet } from "../ui/DriverReturnSheet";
import { DriverThemeProvider } from "@/components/Driver/ui/DriverThemeProvider";

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

// Bearer transport for critical driver calls (cookie fallback stays on).
jest.mock("@/lib/auth/bearer-session", () => ({
  withBearerAuth: jest.fn(async (base: Record<string, string> = {}) => ({
    ...base,
    Authorization: "Bearer test-token",
  })),
}));

import toast from "react-hot-toast";

const onComplete = jest.fn();
const onOpenChange = jest.fn();

function installFetch(response: { ok: boolean; status: number; body?: unknown }) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: response.ok,
      status: response.status,
      json: () => Promise.resolve(response.body ?? {}),
    }),
  ) as unknown as typeof fetch;
}

function renderSheet() {
  return render(
    <DriverThemeProvider>
      <DriverReturnSheet
        open
        onOpenChange={onOpenChange}
        orderNumber="CV-12345"
        onComplete={onComplete}
      />
    </DriverThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Driver path default: the request is accepted for dispatch review (202).
  installFetch({
    ok: true,
    status: 202,
    body: { success: true, status: "PENDING_APPROVAL", requestId: "req-1" },
  });
});

describe("DriverReturnSheet", () => {
  it("renders the request-oriented copy and driver-facing reason options", () => {
    renderSheet();
    expect(screen.getByText("Request a return")).toBeInTheDocument();
    expect(screen.getByText(/a dispatcher will review it/i)).toBeInTheDocument();
    expect(screen.getByText(/keep working the delivery/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /can't make the pickup/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /vehicle issue/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /emergency/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /other/i })).toBeInTheDocument();
    // ADMIN_UNASSIGNED is an admin-only reason — never offered to drivers.
    expect(screen.queryByText(/unassigned/i)).not.toBeInTheDocument();
  });

  it("keeps the submit button disabled until a reason is selected", () => {
    renderSheet();
    const submit = screen.getByRole("button", { name: /request return/i });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /vehicle issue/i }));
    expect(submit).toBeEnabled();
  });

  it("POSTs the reason + details with Bearer auth and cookie fallback", async () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /vehicle issue/i }));
    fireEvent.change(screen.getByPlaceholderText(/optional/i), {
      target: { value: "Flat tire on the 101" },
    });
    fireEvent.click(screen.getByRole("button", { name: /request return/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/orders/CV-12345/return",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            reason: "VEHICLE_ISSUE",
            details: "Flat tire on the 101",
          }),
        }),
      );
    });
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });

  it("reports pending on the 202 driver path with the review toast", async () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /vehicle issue/i }));
    fireEvent.click(screen.getByRole("button", { name: /request return/i }));

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({ pending: true }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Return requested — dispatch will review it",
    );
  });

  it("reports an immediate return on a 200 response (privileged caller)", async () => {
    installFetch({ ok: true, status: 200, body: { success: true, status: "ACTIVE" } });
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /emergency/i }));
    fireEvent.click(screen.getByRole("button", { name: /request return/i }));

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({ pending: false }),
    );
    expect(toast.success).toHaveBeenCalledWith("Delivery returned to dispatch");
  });

  it("omits empty details from the payload", async () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /emergency/i }));
    fireEvent.click(screen.getByRole("button", { name: /request return/i }));

    await waitFor(() => {
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(body).toEqual({ reason: "EMERGENCY" });
    });
  });

  it("surfaces the server error and does not complete on failure", async () => {
    installFetch({
      ok: false,
      status: 409,
      body: {
        success: false,
        error: "The order has already been picked up. Contact dispatch to hand it back.",
        code: "POST_PICKUP",
      },
    });
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /can't make the pickup/i }));
    fireEvent.click(screen.getByRole("button", { name: /request return/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/already been picked up/i),
      ),
    );
    expect(onComplete).not.toHaveBeenCalled();
  });
});
