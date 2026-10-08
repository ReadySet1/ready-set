import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSession = jest.fn().mockResolvedValue({
  data: { session: { access_token: "tok" } },
  error: null,
});

jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: { getSession: mockGetSession },
  })),
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

import toast from "react-hot-toast";
import CustomerEditOrderDialog from "../CustomerEditOrderDialog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function cateringOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    orderNumber: "CAT001",
    order_type: "catering" as const,
    status: "ACTIVE",
    headcount: 20,
    orderTotal: 500,
    dispatches: [],
    ...overrides,
  };
}

function renderDialog(orderOverrides: Record<string, unknown> = {}) {
  const onOpenChange = jest.fn();
  const onSaveSuccess = jest.fn();
  const order = cateringOrder(orderOverrides);

  render(
    <CustomerEditOrderDialog
      isOpen={true}
      onOpenChange={onOpenChange}
      order={order as any}
      onSaveSuccess={onSaveSuccess}
    />,
  );

  return { onOpenChange, onSaveSuccess, order };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CustomerEditOrderDialog", () => {
  it("renders exactly two inputs (Headcount and Order Total)", () => {
    renderDialog();
    const headcount = screen.getByLabelText("Headcount");
    const orderTotal = screen.getByLabelText("Order Total ($)");
    expect(headcount).toBeInTheDocument();
    expect(orderTotal).toBeInTheDocument();

    // No other inputs
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs).toHaveLength(2);
  });

  it("prefills the current values", () => {
    renderDialog({ headcount: 30, orderTotal: 750 });
    expect(screen.getByLabelText("Headcount")).toHaveValue(30);
    expect(screen.getByLabelText("Order Total ($)")).toHaveValue(750);
  });

  it("sends only the changed field (headcount)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          orderNumber: "CAT001",
          headcount: 40,
          orderTotal: "500",
          updatedAt: new Date().toISOString(),
        }),
    });

    const { onSaveSuccess } = renderDialog();
    const user = userEvent.setup();

    const headcountInput = screen.getByLabelText("Headcount");
    await user.clear(headcountInput);
    await user.type(headcountInput, "40");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/user-orders/CAT001");
    const body = JSON.parse(opts.body);
    expect(body).toEqual({ headcount: 40 });
    // Should be a number, not a string
    expect(typeof body.headcount).toBe("number");

    await waitFor(() => expect(onSaveSuccess).toHaveBeenCalled());
  });

  it("sends only the changed field (orderTotal)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          orderNumber: "CAT001",
          headcount: 20,
          orderTotal: "1250.50",
          updatedAt: new Date().toISOString(),
        }),
    });

    renderDialog();
    const user = userEvent.setup();

    const otInput = screen.getByLabelText("Order Total ($)");
    await user.clear(otInput);
    await user.type(otInput, "1250.50");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ orderTotal: 1250.5 });
    expect(typeof body.orderTotal).toBe("number");
  });

  it("shows 'No changes to save' when nothing changed", async () => {
    renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(toast).toHaveBeenCalledWith("No changes to save");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("blocks non-integer headcount (5.9) via API schema validation", async () => {
    renderDialog();
    const user = userEvent.setup();

    const headcountInput = screen.getByLabelText("Headcount");
    await user.clear(headcountInput);
    await user.type(headcountInput, "5.9");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // Should not call fetch — validation catches it client-side
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("blocks 3-decimal orderTotal via API schema validation", async () => {
    renderDialog();
    const user = userEvent.setup();

    const otInput = screen.getByLabelText("Order Total ($)");
    await user.clear(otInput);
    await user.type(otInput, "10.999");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows pair message when clearing both fields", async () => {
    renderDialog({ headcount: 10, orderTotal: null });
    const user = userEvent.setup();

    const headcountInput = screen.getByLabelText("Headcount");
    await user.clear(headcountInput);
    await user.click(screen.getByRole("button", { name: "Save" }));

    // The API schema validation rejects null headcount + no orderTotal → formError
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalled(),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("on 409 response: shows error and calls onSaveSuccess to refresh", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          code: "ORDER_NOT_EDITABLE",
          message: "This order can no longer be edited",
        }),
    });

    const { onSaveSuccess, onOpenChange } = renderDialog();
    const user = userEvent.setup();

    const headcountInput = screen.getByLabelText("Headcount");
    await user.clear(headcountInput);
    await user.type(headcountInput, "40");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "This order can no longer be edited",
      );
    });
    expect(onSaveSuccess).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
